export const CLASSIFIER_PROMPT = `You are a financial SMS classifier.
Your task is to determine if the following SMS message is a financial transaction (like a bank debit/credit, salary credit, UPI payment, or credit card swipe).
If it IS a financial transaction, reply with ONLY the word "YES".
If it IS NOT a financial transaction (like OTPs, promotional messages, personal chats, warnings), reply with ONLY the word "NO".
Do not include any other text or explanation.

SMS Message:
"{sms}"

Classification (YES/NO):`;

export const EXTRACTOR_PROMPT = `You are a financial data extractor.
Extract the transaction details from the following SMS message into a JSON object.
Use EXACTLY this schema:
{
  "amount": number, // just the number, no currency symbols
  "merchant": string, // name of the merchant or person
  "date": string, // DD/MM/YYYY or similar identifiable format
  "type": "credit" | "debit",
  "account": string // Account number or card info e.g., "XX1234"
}
If a field cannot be determined, set it to null.
Reply with ONLY the JSON object and no other text or explanation.

SMS Message:
"{sms}"

JSON Output:`;
