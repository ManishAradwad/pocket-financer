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

export class PipelineService {
    private static isProcessingSms = false;
    private static smsQueue: SmsMessage[] = [];

    /**
     * Processes an incoming SMS message.
     * Enqueues the message and processes them sequentially to avoid concurrent LLM crashes.
     */
    static async processSms(sms: SmsMessage): Promise<void> {
        if (!sms?.body) return;

        if (this.smsQueue.length >= MAX_QUEUE_LEN) {
            console.warn(
                `PipelineService: queue full (${MAX_QUEUE_LEN}), dropping SMS to preserve responsiveness.`,
            );
            return;
        }

        this.smsQueue.push(sms);
        this.processQueue();
    }

    private static async processQueue(): Promise<void> {
        if (this.isProcessingSms || this.smsQueue.length === 0) {
            return;
        }

        this.isProcessingSms = true;

        while (this.smsQueue.length > 0) {
            const current = this.smsQueue.shift();
            if (!current) continue;

            try {
                await this.processSingleSms(current);
            } catch (e) {
                console.error('PipelineService: Error in sequential SMS processing:', e);
            }
        }

        this.isProcessingSms = false;
    }

    private static async processSingleSms(sms: SmsMessage): Promise<void> {
        if (!modelStore.context) {
            console.warn('PipelineService: LLM Context not initialized. Cannot process SMS.');
            return;
        }

        try {
            const isFinancial = await this.classifySms(sms.body);
            if (!isFinancial) return;

            const extracted = await this.extractTransaction(sms.body);
            if (!extracted) return;

            const amount = coerceAmount(extracted.amount);
            if (amount === null) {
                if (__DEV__) {
                    console.warn('PipelineService: dropping transaction with invalid amount');
                }
                return;
            }

            const type = coerceType(extracted.type);
            const accountId = await resolveAccountId(extracted.account);
            const date = coerceDate(extracted.date, sms.date);

            await transactionStore.addTransaction({
                amount,
                merchant: extracted.merchant?.trim() || 'Unknown Merchant',
                date,
                type,
                accountId,
                rawMessage: sms.body,
            });

            if (__DEV__) {
                console.log('PipelineService: saved transaction');
            }
        } catch (e) {
            console.error('PipelineService: Error processing SMS', e);
        }
    }

    private static async classifySms(smsText: string): Promise<boolean> {
        const prompt = renderPrompt(CLASSIFIER_PROMPT, smsText);

        try {
            const result = await withTimeout(
                modelStore.context!.completion({
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    n_predict: 10,
                }),
                CLASSIFIER_TIMEOUT_MS,
                'classifier',
            );
            return result.text.trim().toUpperCase().includes('YES');
        } catch (e) {
            console.error('PipelineService: classification error:', e);
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
            );
            return parseJsonObject(result.text);
        } catch (e) {
            console.error('PipelineService: extraction error:', e);
            return null;
        }
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`PipelineService: ${label} timed out after ${ms}ms`)),
            ms,
        );
        promise.then(
            v => {
                clearTimeout(timer);
                resolve(v);
            },
            e => {
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
            const parsed = new Date(year, month, day).getTime();
            if (Number.isFinite(parsed)) return parsed;
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
