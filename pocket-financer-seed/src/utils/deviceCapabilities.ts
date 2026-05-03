import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import NativeHardwareInfo from '../specs/NativeHardwareInfo';
import type {CPUInfo, GPUInfo} from '../specs/NativeHardwareInfo';

/**
 * Device GPU capabilities result
 */
export interface GpuCapabilities {
  /** Whether GPU acceleration is supported on this device */
  isSupported: boolean;
  /** Reason why GPU is not supported (if applicable) */
  reason?:
    | 'ios_version'
    | 'no_adreno'
    | 'missing_cpu_features'
    | 'simulator'
    | 'unknown';
  /** Detailed information about missing requirements */
  details?: {
    hasAdreno?: boolean;
    hasI8mm?: boolean;
    hasDotProd?: boolean;
    iosVersion?: number;
    isSimulator?: boolean;
  };
}

/**
 * Check if the device supports GPU acceleration.
 *
 * Requirements:
 * - iOS: Requires iOS 18 or higher for Metal acceleration
 * - Android: Requires Adreno GPU + i8mm CPU feature + dotprod CPU feature for Vulkan/OpenCL
 *
 * These are the requirements imposed by llama.rn's GPU builds.
 *
 * @returns Promise<GpuCapabilities> GPU support status and details
 */
export async function checkGpuSupport(): Promise<GpuCapabilities> {
  // Check for simulator/emulator first
  const isSimulator = await DeviceInfo.isEmulator();
  if (isSimulator) {
    return {
      isSupported: false,
      reason: 'simulator',
      details: { isSimulator: true },
    };
  }

  if (Platform.OS === 'ios') {
    const iosVersion = parseInt(Platform.Version as string, 10);
    const isSupported = iosVersion >= 18;
    return {
      isSupported,
      reason: isSupported ? undefined : 'ios_version',
      details: { iosVersion },
    };
  } else if (Platform.OS === 'android') {
    // Android requires Adreno GPU + i8mm + dotprod CPU features
    try {
      const [gpuInfo, cpuInfo] = await Promise.all([
        NativeHardwareInfo.getGPUInfo(),
        NativeHardwareInfo.getCPUInfo(),
      ]);

      const hasAdreno = gpuInfo.hasAdreno ?? false;
      const hasI8mm = cpuInfo.hasI8mm ?? false;
      const hasDotProd = cpuInfo.hasDotProd ?? false;

      const isSupported = hasAdreno && hasI8mm && hasDotProd;

      let reason: GpuCapabilities['reason'];
      if (!isSupported) {
        if (!hasAdreno) {
          reason = 'no_adreno';
        } else if (!hasI8mm || !hasDotProd) {
          reason = 'missing_cpu_features';
        } else {
          reason = 'unknown';
        }
      }

      return {
        isSupported,
        reason,
        details: { hasAdreno, hasI8mm, hasDotProd },
      };
    } catch (error) {
      console.warn('Failed to check GPU support:', error);
      return { isSupported: false, reason: 'unknown' };
    }
  }

  return { isSupported: false, reason: 'unknown' };
}
