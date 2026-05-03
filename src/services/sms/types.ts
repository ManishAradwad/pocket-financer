export interface SmsFilter {
  minDate?: number;
  maxDate?: number;
  addressPattern?: string;
  limit?: number;
  offset?: number;
}

export interface SmsMessage {
  address: string;
  body: string;
  date: number;
  type: number; // 1 = Inbox
}
