/**
 * useDeepLinking Hook
 *
 * Handles deep link navigation from iOS Shortcuts
 * Must be called from a component inside NavigationContainer
 */

import {useEffect, useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import {deepLinkService, DeepLinkParams} from '../services/DeepLinkService';
import {deepLinkStore} from '../store';
import {ROUTES} from '../utils/navigationConstants';

/**
 * Hook for handling deep link navigation
 * Call this once in a component inside NavigationContainer
 */
export const useDeepLinking = () => {
  const navigation = useNavigation();

  const handleDeepLink = useCallback(
    async (params: DeepLinkParams) => {
      console.log('Handling deep link:', params);

      // Handle memory profiling deep links (E2E only)
      if (params.host === 'memory' && params.queryParams?.cmd) {
        const {
          takeMemorySnapshot,
          clearMemorySnapshots,
        } = require('../utils/memoryProfile');
        const cmd = params.queryParams.cmd;
        if (cmd.startsWith('snap::')) {
          const label = cmd.slice(6) || 'unnamed';
          await takeMemorySnapshot(label);
        } else if (cmd === 'clear::snapshots') {
          await clearMemorySnapshots();
        }
        return;
      }

      // Handle chat deep links
      if (params.host === 'chat') {
        const message = params.queryParams?.message;

        // Store message to prefill if provided
        if (message) {
          deepLinkStore.setPendingMessage(message);
        }

        // Navigate to chat screen
        (navigation as any).navigate(ROUTES.CHAT);
      }
    },
    [navigation],
  );

  useEffect(() => {
    // Initialize deep link service
    deepLinkService.initialize();

    // Add deep link handler
    const removeListener = deepLinkService.addListener(handleDeepLink);

    // Cleanup on unmount
    return () => {
      removeListener();
      deepLinkService.cleanup();
    };
  }, [handleDeepLink]);
};

/**
 * Hook for accessing pending message state
 * Can be called from any component (doesn't require navigation)
 */
export const usePendingMessage = () => {
  return {
    pendingMessage: deepLinkStore.pendingMessage,
    clearPendingMessage: () => {
      deepLinkStore.clearPendingMessage();
    },
  };
};
