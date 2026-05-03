/**
 * Prompt templates. The `{sms_json}` placeholder is replaced with a
 * JSON-encoded string of the SMS body so that quotes, newlines, or
 * braces inside the message cannot break the prompt.
 */

export const CLASSIFIER_PROMPT = `You are a financial SMS classifier.
Your task is to determine if the following SMS message is a financial transaction (like a bank debit/credit, salary credit, UPI payment, or credit card swipe).
If it IS a financial transaction, reply with ONLY the word "YES".
If it IS NOT a financial transaction (like OTPs, promotional messages, personal chats, warnings), reply with ONLY the word "NO".
Do not include any other text or explanation.

SMS Message (JSON-encoded string):
{sms_json}

Classification (YES/NO):`;

export const EXTRACTOR_PROMPT = `You are a financial data extractor.
Extract the transaction details from the following SMS message into a JSON object.
Use EXACTLY this schema:
{
  "amount": number, // just the number, no currency symbols
  "merchant": string, // name of the merchant or person
  "date": string, // DD/MM/YYYY
  "type": "credit" | "debit",
  "account": string // Account number or card info e.g., "XX1234"
}
If a field cannot be determined, set it to null.
Reply with ONLY the JSON object and no other text or explanation.

SMS Message (JSON-encoded string):
{sms_json}

JSON Output:`;

/**
 * Safely interpolate an arbitrary SMS body into a prompt template.
 * JSON.stringify handles escaping of quotes, backslashes, and control
 * characters, which naive string replacement would not.
 */
export function renderPrompt(template: string, smsBody: string): string {
  return template.replace('{sms_json}', JSON.stringify(smsBody));
}
