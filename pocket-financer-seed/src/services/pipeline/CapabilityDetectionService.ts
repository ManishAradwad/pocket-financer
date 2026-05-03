import {modelService} from '../model/ModelService';
import {checkGpuSupport} from '../../utils/deviceCapabilities';
import DeviceInfo from 'react-native-device-info';
import {Alert} from 'react-native';

export class CapabilityDetectionService {
  /**
   * Evaluates the device capabilities on app launch.
   *
   * Checks:
   * 1. RAM >= 2GB (hard requirement)
   * 2. GPU support (for acceleration — optional, falls back to CPU)
   *
   * If GPU is available, configures llama.rn to use it.
   * If RAM is insufficient, blocks the user.
   *
   * Returns true if the app can proceed, false if the device is blocked.
   */
  static async checkAndInit(): Promise<boolean> {
    try {
      const ram = await DeviceInfo.getTotalMemory();
      const ramGB = ram / 1000 / 1000 / 1000;

      // Absolute minimum: 2GB RAM
      if (ramGB < 2.0) {
        Alert.alert(
          'Device Not Supported',
          'Pocket Financer requires at least 2GB of RAM to process your SMS securely on-device.',
          [{text: 'OK'}],
        );
        return false;
      }

      // GPU detection — check if Vulkan/OpenCL acceleration is available
      try {
        const gpuCaps = await checkGpuSupport();
        if (gpuCaps.isSupported) {
          console.log('GPU acceleration available, enabling Vulkan backend');
          modelService.setGpuLayers(99);
        } else {
          console.log(
            `GPU acceleration not available (${gpuCaps.reason}), using CPU only`,
          );
          modelService.setGpuLayers(0);
        }
      } catch (e) {
        console.warn('GPU detection failed, defaulting to CPU', e);
        modelService.setGpuLayers(0);
      }

      return true;
    } catch (e) {
      console.error('Failed to detect capabilities', e);
      return true; // Proceed — let it fail naturally if hardware is insufficient
    }
  }
}
