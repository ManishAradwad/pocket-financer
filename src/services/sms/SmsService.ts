import {PermissionsAndroid, Platform, NativeEventEmitter} from 'react-native';
import NativeSmsModule from '../../specs/NativeSmsModule';
import {SmsFilter, SmsMessage} from './types';

class SmsService {
  private eventEmitter: NativeEventEmitter | null = null;
  private isListening = false;

  constructor() {
    if (Platform.OS === 'android' && NativeSmsModule) {
      this.eventEmitter = new NativeEventEmitter(NativeSmsModule as any);
    }
  }

  async hasPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeSmsModule) return false;
    try {
      return await NativeSmsModule.hasPermissions();
    } catch (e) {
      console.error('Failed to check SMS permissions natively', e);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);

      return (
        granted['android.permission.READ_SMS'] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.RECEIVE_SMS'] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn('Failed to request SMS permissions', err);
      return false;
    }
  }

  async fetchSmsHistory(filter: SmsFilter = {}): Promise<SmsMessage[]> {
    if (Platform.OS !== 'android' || !NativeSmsModule) {
      throw new Error('SMS Module is only available on Android');
    }

    const hasPerms = await this.hasPermissions();
    if (!hasPerms) {
      throw new Error('SMS permissions not granted');
    }

    return await NativeSmsModule.getSmsByFilter(filter);
  }

  private currentSubscription: any = null;

  startListening(onSmsReceived: (sms: SmsMessage) => void): () => void {
    if (Platform.OS !== 'android' || !this.eventEmitter) {
      console.warn(
        'SMS listening is only supported on Android with NativeSmsModule',
      );
      return () => {};
    }

    if (this.isListening && this.currentSubscription) {
      console.warn(
        'SmsService is already listening, replacing existing listener.',
      );
      this.currentSubscription.remove();
    }

    this.isListening = true;
    this.currentSubscription = this.eventEmitter.addListener(
      'onSmsReceived',
      (sms: SmsMessage) => {
        onSmsReceived(sms);
      },
    );

    return () => {
      if (this.currentSubscription) {
        this.currentSubscription.remove();
        this.currentSubscription = null;
      }
      this.isListening = false;
    };
  }
}

export default new SmsService();
