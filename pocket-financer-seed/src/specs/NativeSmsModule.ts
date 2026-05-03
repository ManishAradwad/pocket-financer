import type {TurboModule} from 'react-native';
import {Platform, TurboModuleRegistry} from 'react-native';

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

export interface Spec extends TurboModule {
  requestPermissions(): Promise<boolean>;
  hasPermissions(): Promise<boolean>;
  getSmsByFilter(filter: SmsFilter): Promise<SmsMessage[]>;

  // Event emitter methods
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

// Only load the module on Android
export default Platform.OS === 'android'
  ? TurboModuleRegistry.getEnforcing<Spec>('SmsModule')
  : (null as any as Spec);
