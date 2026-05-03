/**
 * Prompt templates for pocket-financer.
 *
 * The {sms_json} placeholder is replaced with a JSON-encoded string of the
 * SMS body so that quotes, newlines, or braces inside the message cannot
 * break the prompt.
 *
 * DESIGN: Single combined prompt. The SLM either returns `null` for
 * non-financial SMS (OTPs, promotions, personal messages) or a structured
 * JSON object for financial transactions. No separate classification stage.
 *
 * NOTE: The `date` field is intentionally omitted — the app uses the SMS
 * arrival timestamp from Android, which is always accurate and requires
 * zero SLM inference cost.
 */

export const EXTRACTOR_PROMPT = `You are a financial transaction extractor for Indian SMS messages.

Analyze the following SMS and determine if it is a financial transaction (bank debit/credit, salary credit, UPI payment, credit card swipe, NEFT/IMPS, bill payment).

If it IS a financial transaction, extract the details and return EXACTLY this JSON:
{
  "amount": number,
  "merchant": string,
  "type": "credit" | "debit",
  "account": string
}

- amount: the transaction amount as a number (no currency symbols, no commas)
- merchant: the name of the merchant, person, or bank involved
- type: "credit" if money was received, "debit" if money was sent/paid
- account: account number suffix or card info (e.g., "XX7788", "XX4521", "A/c XX6254"). Set to null if not determinable.

If it IS NOT a financial transaction (OTP, promotional message, personal chat, service alert, warning), return exactly:
null

Reply with ONLY the JSON object or null — no other text, no markdown fences, no explanation.

SMS Message (JSON-encoded string):
{sms_json}

Output:`;

/**
 * Safely interpolate an arbitrary SMS body into a prompt template.
 * JSON.stringify handles escaping of quotes, backslashes, and control
 * characters, which naive string replacement would not.
 */
export function renderPrompt(template: string, smsBody: string): string {
  return template.replace('{sms_json}', JSON.stringify(smsBody));
}
