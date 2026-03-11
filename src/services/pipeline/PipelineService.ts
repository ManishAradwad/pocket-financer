import { modelStore } from '../../store';
import { transactionStore } from '../../store/TransactionStore';
import { CLASSIFIER_PROMPT, EXTRACTOR_PROMPT } from './Prompts';

export class PipelineService {
    private static isProcessingSms = false;
    private static smsQueue: string[] = [];

    /**
     * Processes an incoming raw SMS message.
     * Enqueues the message and processes them sequentially to avoid concurrent LLM crashes.
     * @param smsText The raw SMS content
     */
    static async processSms(smsText: string): Promise<void> {
        this.smsQueue.push(smsText);
        this.processQueue();
    }

    private static async processQueue(): Promise<void> {
        if (this.isProcessingSms || this.smsQueue.length === 0) {
            return;
        }

        this.isProcessingSms = true;

        while (this.smsQueue.length > 0) {
            const currentSms = this.smsQueue.shift();
            if (!currentSms) continue;

            try {
                await this.processSingleSms(currentSms);
            } catch (e) {
                console.error('PipelineService: Error in sequential SMS processing:', e);
            }
        }

        this.isProcessingSms = false;
    }

    private static async processSingleSms(smsText: string): Promise<void> {
        if (!modelStore.context) {
            console.warn('PipelineService: LLM Context not initialized. Cannot process SMS.');
            return;
        }

        try {
            console.log('PipelineService: Starting classification for SMS...');
            const isFinancial = await this.classifySms(smsText);

            if (!isFinancial) {
                console.log('PipelineService: SMS is NOT financial. Skipping.');
                return;
            }

            console.log('PipelineService: SMS is financial. Starting extraction...');
            const extractedData = await this.extractTransaction(smsText);

            if (!extractedData) {
                console.warn('PipelineService: Extraction failed or returned no data.');
                return;
            }

            console.log('PipelineService: Extracted transaction payload:', JSON.stringify(extractedData, null, 2));

            console.log('PipelineService: Saving transaction to DB...');

            // Save account if we have one
            let accountId = 'unknown_account';
            if (extractedData.account) {
                const account = await transactionStore.getOrCreateAccount(
                    extractedData.account,
                    'Unknown Bank',
                    'auto-extracted'
                );
                if (account) {
                    accountId = account.id;
                }
            }

            await transactionStore.addTransaction({
                amount: Number(extractedData.amount) || 0,
                merchant: extractedData.merchant || 'Unknown Merchant',
                date: Date.now(), // Fallback to now for demo, ideally parse the extractedData.date
                type: extractedData.type || 'debit',
                accountId,
                rawMessage: smsText || '',
            });

            console.log('PipelineService: Successfully processed and saved transaction.');
        } catch (e) {
            console.error('PipelineService: Error processing SMS', e);
        }
    }

    private static async classifySms(smsText: string): Promise<boolean> {
        const prompt = CLASSIFIER_PROMPT.replace('{sms}', smsText);

        try {
            const result = await modelStore.context!.completion({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1, // Low temp for deterministic classification
                n_predict: 10,
            });

            console.log('PipelineService: LLM Classification Output:', result.text);

            const responseText = result.text.trim().toUpperCase();
            return responseText.includes('YES');
        } catch (e) {
            console.error('Classification error:', e);
            return false;
        }
    }

    private static async extractTransaction(smsText: string): Promise<any | null> {
        const prompt = EXTRACTOR_PROMPT.replace('{sms}', smsText);

        try {
            const result = await modelStore.context!.completion({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: {
                    type: 'json_object', // Ensure JSON output if supported by model settings
                },
                n_predict: 200,
            });

            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch {
                    return JSON.parse(result.text);
                }
            }
            return JSON.parse(result.text);
        } catch (e) {
            console.error('Extraction error:', e);
            return null;
        }
    }
}
