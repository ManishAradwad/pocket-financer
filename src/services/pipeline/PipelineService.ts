import { modelStore } from '../../store';
import { transactionStore } from '../../store/TransactionStore';
import type { SmsMessage } from '../sms/types';
import { CLASSIFIER_PROMPT, EXTRACTOR_PROMPT, renderPrompt } from './Prompts';

const CLASSIFIER_TIMEOUT_MS = 20_000;
const EXTRACTOR_TIMEOUT_MS = 30_000;

/** Drop new SMS once the queue backlog exceeds this, to avoid pinning the LLM for hours. */
const MAX_QUEUE_LEN = 200;

type ExtractedTransaction = {
    amount: number | string | null;
    merchant: string | null;
    date: string | null;
    type: string | null;
    account: string | null;
};

export type PipelineStage =
    | 'enqueue'
    | 'enqueue:dropped'
    | 'classify:start'
    | 'classify:done'
    | 'classify:skip'
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
     * Subscribe to per-stage pipeline events (for DevTools visibility).
     * Listeners receive the classifier output, the extracted JSON, and save
     * results in real time. Returns an unsubscribe function.
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
        if (!modelStore.context) {
            this.emit({
                stage: 'error',
                message: 'LLM context not initialized, skipping SMS',
            });
            return;
        }

        try {
            const isFinancial = await this.classifySms(sms.body);
            if (!isFinancial) {
                this.emit({ stage: 'classify:skip', message: 'not financial, skipping' });
                return;
            }

            this.emit({ stage: 'extract:start', message: 'running extractor' });
            const extracted = await this.extractTransaction(sms.body);
            if (!extracted) {
                this.emit({
                    stage: 'extract:empty',
                    message: 'extractor returned no parseable JSON',
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
            const date = coerceDate(extracted.date, sms.date);

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

    private static async classifySms(smsText: string): Promise<boolean> {
        const prompt = renderPrompt(CLASSIFIER_PROMPT, smsText);

        this.emit({ stage: 'classify:start', message: 'running classifier' });
        try {
            const result = await withTimeout(
                modelStore.context!.completion({
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    n_predict: 10,
                }),
                CLASSIFIER_TIMEOUT_MS,
                'classifier',
                () => modelStore.context?.stopCompletion(),
            );
            // Strict equality: a substring check would let "YES, this is..." or
            // an echoed prompt through. The prompt asks for exactly YES or NO.
            const normalized = result.text.trim().toUpperCase();
            const isFinancial = normalized === 'YES';
            this.emit({
                stage: 'classify:done',
                message: isFinancial ? 'YES (financial)' : `NO (not financial)`,
                data: result.text,
            });
            return isFinancial;
        } catch (e) {
            this.emit({
                stage: 'error',
                message: 'classification error',
                data: String(e),
            });
            return false;
        }
    }

    private static async extractTransaction(
        smsText: string,
    ): Promise<ExtractedTransaction | null> {
        const prompt = renderPrompt(EXTRACTOR_PROMPT, smsText);

        try {
            const result = await withTimeout(
                modelStore.context!.completion({
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    response_format: { type: 'json_object' },
                    n_predict: 200,
                }),
                EXTRACTOR_TIMEOUT_MS,
                'extractor',
                () => modelStore.context?.stopCompletion(),
            );
            return parseJsonObject(result.text);
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
 * (typically `context.stopCompletion()`) so the native engine actually
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

/**
 * Parses DD/MM/YYYY (with - or . separators) into a millisecond timestamp.
 * Falls back to the SMS arrival timestamp if the string cannot be parsed.
 */
function coerceDate(raw: string | null, smsDate: number): number {
    if (raw) {
        const match = raw.match(/^\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
        if (match) {
            const day = Number(match[1]);
            const month = Number(match[2]) - 1;
            let year = Number(match[3]);
            if (year < 100) year += 2000;
            const d = new Date(year, month, day);
            // Round-trip check: JS silently normalises invalid dates
            // (e.g. 31/02/2025 -> 03/03/2025), so confirm the constructed
            // date actually has the components we asked for.
            if (
                d.getFullYear() === year &&
                d.getMonth() === month &&
                d.getDate() === day
            ) {
                return d.getTime();
            }
        }
    }
    if (Number.isFinite(smsDate) && smsDate > 0) return smsDate;
    return Date.now();
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
