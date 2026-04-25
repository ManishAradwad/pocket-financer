import DeviceInfo from 'react-native-device-info';
import { Alert } from 'react-native';

export class CapabilityDetectionService {
    /**
     * Enforces the minimum device RAM requirement on app launch.
     * Returns true if the app can proceed, false if the device is blocked.
     */
    static async checkDeviceSupport(): Promise<boolean> {
        try {
            const ram = await DeviceInfo.getTotalMemory();
            const ramGB = ram / 1000 / 1000 / 1000;

            // Absolute minimum requirement: 2GB RAM. If less, we block.
            if (ramGB < 2.0) {
                Alert.alert(
                    'Device Not Supported',
                    'Pocket-Financer requires at least 2GB of RAM to process your SMS securely on-device without any data leaving your phone. Your device currently does not meet this requirement.',
                    [{ text: 'OK' }],
                );
                return false;
            }

            return true;
        } catch (e) {
            console.error('Failed to detect capabilities', e);
            // In case of error reading specs, we allow it to proceed natively, it might crash later but we try.
            return true;
        }
    }
}
