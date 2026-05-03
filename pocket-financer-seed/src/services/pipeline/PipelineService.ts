import { modelService } from '../model/ModelService';
import { transactionStore } from '../../store/TransactionStore';
import type { SmsMessage } from '../sms/types';
import { EXTRACTOR_PROMPT, renderPrompt } from './Prompts';

const EXTRACTOR_TIMEOUT_MS = 30_000;

/** Drop new SMS once the queue backlog exceeds this, to avoid pinning the LLM for hours. */
const MAX_QUEUE_LEN = 200;

type ExtractedTransaction = {
    amount: number | null;
    merchant: string | null;
    type: string | null;
    account: string | null;
    // NOTE: date is intentionally omitted — we use the SMS arrival timestamp
};

export type PipelineStage =
    | 'enqueue'
    | 'enqueue:dropped'
    | 'extract:start'
    | 'extract:done'
    | 'extract:empty'
    | 'save:start'
    | 'save:done'
    | 'save:invalid'
    | 'error';

export type PipelineStep = {
    stage: PipelineStage;
    message: string;
    data?: unknown;
    at: number;
};

type StepListener = (step: PipelineStep) => void;

export class PipelineService {
    private static isProcessingSms = false;
    private static smsQueue: SmsMessage[] = [];
    private static debugListeners = new Set<StepListener>();

    /**
     * Subscribe to per-stage pipeline events (for sync strip progress,
     * debug visibility, etc.). Returns an unsubscribe function.
     */
    static subscribeDebug(listener: StepListener): () => void {
        this.debugListeners.add(listener);
        return () => {
            this.debugListeners.delete(listener);
        };
    }

    /**
     * Processes an incoming SMS message.
     * Enqueues the message and processes them sequentially to avoid concurrent LLM crashes.
     */
    static async processSms(sms: SmsMessage): Promise<void> {
        if (!sms?.body) return;

        if (this.smsQueue.length >= MAX_QUEUE_LEN) {
            this.emit({
                stage: 'enqueue:dropped',
                message: `queue full (${MAX_QUEUE_LEN}), dropped`,
            });
            return;
        }

        this.smsQueue.push(sms);
        this.emit({
            stage: 'enqueue',
            message: 'queued',
            data: { address: sms.address, body: sms.body, date: sms.date },
        });
        this.processQueue();
    }

    private static async processQueue(): Promise<void> {
        if (this.isProcessingSms || this.smsQueue.length === 0) return;

        this.isProcessingSms = true;

        while (this.smsQueue.length > 0) {
            const current = this.smsQueue.shift();
            if (!current) continue;

            try {
                await this.processSingleSms(current);
            } catch (e) {
                this.emit({
                    stage: 'error',
                    message: 'unhandled error in sequential processing',
                    data: String(e),
                });
            }
        }

        this.isProcessingSms = false;
    }

    private static async processSingleSms(sms: SmsMessage): Promise<void> {
        if (!modelService.isLoaded()) {
            this.emit({
                stage: 'error',
                message: 'LLM not loaded, skipping SMS',
            });
            return;
        }

        try {
            this.emit({ stage: 'extract:start', message: 'running extractor' });

            const extracted = await this.extractTransaction(sms.body);

            // null means non-financial SMS — skip it
            if (!extracted) {
                this.emit({
                    stage: 'extract:empty',
                    message: 'not a financial transaction, skipping',
                });
                return;
            }

            this.emit({
                stage: 'extract:done',
                message: 'extractor produced JSON',
                data: extracted,
            });

            const amount = coerceAmount(extracted.amount);
            if (amount === null) {
                this.emit({
                    stage: 'save:invalid',
                    message: 'invalid amount, not saving',
                    data: extracted.amount,
                });
                return;
            }

            const type = coerceType(extracted.type);
            const accountId = await resolveAccountId(extracted.account);
            const date = sms.date; // Always use the SMS arrival timestamp

            this.emit({ stage: 'save:start', message: 'writing transaction' });
            const tx = await transactionStore.addTransaction({
                amount,
                merchant: extracted.merchant?.trim() || 'Unknown Merchant',
                date,
                type,
                accountId,
                rawMessage: sms.body,
            });
            this.emit({
                stage: 'save:done',
                message: 'transaction saved',
                data: {
                    id: tx?.id,
                    amount,
                    merchant: extracted.merchant,
                    type,
                    date,
                    accountId,
                },
            });
        } catch (e) {
            this.emit({
                stage: 'error',
                message: 'error processing SMS',
                data: String(e),
            });
        }
    }

    /**
     * Single LLM call: returns null for non-financial SMS, or a structured
     * JSON object for financial transactions. No separate classifier.
     */
    private static async extractTransaction(
        smsText: string,
    ): Promise<ExtractedTransaction | null> {
        const prompt = renderPrompt(EXTRACTOR_PROMPT, smsText);

        try {
            const result = await withTimeout(
                modelService.complete(prompt, {
                    temperature: 0.1,
                    response_format: { type: 'json_object' },
                    n_predict: 200,
                }),
                EXTRACTOR_TIMEOUT_MS,
                'extractor',
                () => modelService.stopCompletion(),
            );

            // If the model returned literally "null", treat as non-financial
            if (result.trim() === 'null') {
                return null;
            }

            const parsed = parseJsonObject(result);
            // If parsed is null, it's either truly null (non-financial) or
            // unparseable junk. Either way, skip.
            return parsed;
        } catch (e) {
            this.emit({
                stage: 'error',
                message: 'extraction error',
                data: String(e),
            });
            return null;
        }
    }

    /**
     * Fans a pipeline step out to DevTools listeners and, in __DEV__ only,
     * to the console. Production builds never see SMS-derived PII in logcat.
     */
    private static emit(step: Omit<PipelineStep, 'at'>): void {
        const full: PipelineStep = { ...step, at: Date.now() };
        if (__DEV__) {
            if (full.data !== undefined) {
                console.log(`PipelineService[${full.stage}] ${full.message}`, full.data);
            } else {
                console.log(`PipelineService[${full.stage}] ${full.message}`);
            }
        }
        this.debugListeners.forEach(listener => {
            try {
                listener(full);
            } catch {
                /* listener errors must not affect the pipeline */
            }
        });
    }
}

/**
 * Race a promise against a deadline. On timeout we (1) call `onTimeout`
 * (typically `modelService.stopCompletion()`) so the native engine actually
 * aborts, then (2) await the original promise's settlement before rejecting.
 * Without step 2 the queue would launch the next completion while the
 * previous native call is still winding down — exactly the concurrent-LLM
 * crash mode we're trying to avoid.
 */
function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
    onTimeout?: () => void | Promise<void>,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let timedOut = false;
        const timer = setTimeout(async () => {
            timedOut = true;
            try {
                await onTimeout?.();
            } catch {
                /* best-effort abort */
            }
            try {
                await promise;
            } catch {
                /* swallow — caller already considers this a timeout */
            }
            reject(new Error(`PipelineService: ${label} timed out after ${ms}ms`));
        }, ms);
        promise.then(
            v => {
                if (timedOut) return;
                clearTimeout(timer);
                resolve(v);
            },
            e => {
                if (timedOut) return;
                clearTimeout(timer);
                reject(e);
            },
        );
    });
}

function parseJsonObject(text: string | undefined): ExtractedTransaction | null {
    if (!text) return null;

    // Strip markdown code fences if the model added them.
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenceMatch ? fenceMatch[1] : text;

    // Prefer the outermost JSON object to skip any prose the model prepends.
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    const slice = start !== -1 && end > start ? candidate.slice(start, end + 1) : candidate;

    try {
        const parsed = JSON.parse(slice);
        if (parsed && typeof parsed === 'object') {
            return parsed as ExtractedTransaction;
        }
    } catch {
        /* fall through */
    }
    return null;
}

function coerceAmount(raw: ExtractedTransaction['amount']): number | null {
    if (raw === null || raw === undefined) return null;
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function coerceType(raw: ExtractedTransaction['type']): 'credit' | 'debit' {
    const v = (raw ?? '').toString().trim().toLowerCase();
    return v === 'credit' ? 'credit' : 'debit';
}

async function resolveAccountId(account: string | null | undefined): Promise<string> {
    if (account && account.trim()) {
        const row = await transactionStore.getOrCreateAccount(
            account.trim(),
            'Unknown Bank',
            'auto-extracted',
        );
        if (row) return row.id;
    }
    const fallback = await transactionStore.ensureDefaultAccount();
    return fallback.id;
}
