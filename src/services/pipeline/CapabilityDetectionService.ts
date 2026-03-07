import { modelStore } from '../../store';
import { hasEnoughMemory } from '../../hooks/useMemoryCheck';
import { isHighEndDevice, getCpuCoreCount } from '../../utils/deviceCapabilities';
import DeviceInfo from 'react-native-device-info';
import { Alert } from 'react-native';

export class CapabilityDetectionService {
    /**
     * Evaluates the device capabilities on app launch and automatically selects
     * the best suitable LLM or blocks the user if the device is unsupported.
     * Returns true if the app can proceed, false if the device is blocked.
     */
    static async checkAndSelectModel(): Promise<boolean> {
        try {
            const ram = await DeviceInfo.getTotalMemory();
            const ramGB = ram / 1000 / 1000 / 1000;
            const cpuCores = await getCpuCoreCount();

            // Absolute minimum requirement: 2GB RAM. If less, we block.
            if (ramGB < 2.0) {
                Alert.alert(
                    'Device Not Supported',
                    'Pocket-Financer requires at least 2GB of RAM to process your SMS securely on-device without any data leaving your phone. Your device currently does not meet this requirement.',
                    [{ text: 'OK' }],
                );
                return false;
            }

            // We have available models in ModelStore. Let's see if we have downloaded models.
            const downloadedModels = modelStore.availableModels;
            if (downloadedModels.length === 0) {
                // No models downloaded yet. We just let the UI handle the "No Model" state, 
                // which usually prompts the user to go to ModelsScreen and download one.
                return true;
            }

            const activeModelId = modelStore.activeModel?.id;

            // If we don't have an active model but we have downloaded ones, we pick the most optimal one.
            // Logic: 
            // High end -> keep the largest/best one 
            // Mid-range -> pick standard
            // Low-range (2-4GB) -> pick the smallest available model

            if (!activeModelId) {
                // Sort models by size ascending
                const sortedModels = [...downloadedModels].sort((a, b) => {
                    return (a.size || 0) - (b.size || 0);
                });

                let selectedModelId = sortedModels[0].id; // Fallback to smallest

                if (ramGB >= 6) {
                    // Can pick the largest we have
                    selectedModelId = sortedModels[sortedModels.length - 1].id;
                } else if (ramGB >= 4) {
                    // Pick something in the middle or second largest
                    selectedModelId = sortedModels[Math.floor(sortedModels.length / 2)].id;
                }

                modelStore.setActiveModel(selectedModelId);
            }

            return true;
        } catch (e) {
            console.error('Failed to detect capabilities', e);
            // In case of error reading specs, we allow it to proceed natively, it might crash later but we try.
            return true;
        }
    }
}
