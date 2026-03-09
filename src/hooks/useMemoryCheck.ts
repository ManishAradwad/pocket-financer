import React, { useEffect, useState } from 'react';
import DeviceInfo from 'react-native-device-info';
import { L10nContext } from '../utils';
import { isHighEndDevice } from '../utils/deviceCapabilities';

function memoryRequirementEstimate(modelSize: number, isMultimodal = false) {
  // Model parameters derived by fitting a linear regression to benchmark data
  // from: https://huggingface.co/spaces/a-ghorbani/ai-phone-leaderboard
  const modelSizeGB = modelSize / 1000 / 1000 / 1000;
  const baseRequirement = 0.43 + (0.92 * modelSizeGB);

  // Add overhead for multimodal models
  if (isMultimodal) {
    // Dynamically scale multimodal overhead based on the base model size
    // Roughly 50% of the model size, with a minimum of 0.4GB and max 1.8GB
    const multimodalOverhead = Math.min(1.8, Math.max(0.4, modelSizeGB * 0.5));
    return baseRequirement + multimodalOverhead;
  }

  return baseRequirement;
}

export const hasEnoughMemory = async (
  modelSize: number,
  isMultimodal = false,
): Promise<boolean> => {
  const totalMemory = await DeviceInfo.getTotalMemory();
  const totalMemoryGB = totalMemory / 1000 / 1000 / 1000;
  const availableMemory = Math.min(totalMemoryGB * 0.65, totalMemoryGB - 1.2);
  const memoryRequirement = memoryRequirementEstimate(modelSize, isMultimodal);

  return memoryRequirement <= availableMemory;
};

export const useMemoryCheck = (modelSize: number, isMultimodal = false) => {
  const l10n = React.useContext(L10nContext);
  const [memoryWarning, setMemoryWarning] = useState('');
  const [shortMemoryWarning, setShortMemoryWarning] = useState('');
  const [multimodalWarning, setMultimodalWarning] = useState('');

  useEffect(() => {
    const checkMemory = async () => {
      // Reset warnings first
      setMemoryWarning('');
      setShortMemoryWarning('');
      setMultimodalWarning('');

      try {
        const hasMemory = await hasEnoughMemory(modelSize, isMultimodal);

        if (!hasMemory) {
          setShortMemoryWarning(l10n.memory.shortWarning);
          setMemoryWarning(l10n.memory.warning);
        }

        // Additional check for multimodal capability
        if (isMultimodal) {
          const modelSizeGB = modelSize / 1000 / 1000 / 1000;
          const isSmallModel = modelSizeGB < 2.0;

          const isCapable = await isHighEndDevice();
          if (!isCapable && !isSmallModel) {
            setMultimodalWarning(l10n.memory.multimodalWarning);
          }
        }
      } catch (error) {
        // Clear all warnings when there's an error
        setMemoryWarning('');
        setShortMemoryWarning('');
        setMultimodalWarning('');
        console.error('Memory check failed:', error);
      }
    };

    checkMemory();
  }, [modelSize, isMultimodal, l10n]);

  return { memoryWarning, shortMemoryWarning, multimodalWarning };
};
