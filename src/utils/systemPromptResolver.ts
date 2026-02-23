import type { Model } from './types';

export interface SystemPromptDependencies {
  model?: Model | null;
}

/**
 * Resolves the system prompt based on priority:
 * 1. Model's chat template system prompt
 * 2. Empty string if it doesn't exist
 */
export function resolveSystemPrompt(
  dependencies: SystemPromptDependencies,
): string {
  const { model } = dependencies;

  // Priority 1: Model's chat template system prompt
  if (model?.chatTemplate?.systemPrompt) {
    return model.chatTemplate.systemPrompt;
  }

  // Priority 3: Empty string
  return '';
}

/**
 * Resolves system prompt and formats it as a system message array
 * Returns empty array if no system prompt is available
 */
export function resolveSystemMessages(
  dependencies: SystemPromptDependencies,
): Array<{ role: 'system'; content: string }> {
  const systemPrompt = resolveSystemPrompt(dependencies);

  if (!systemPrompt.trim()) {
    return [];
  }

  return [
    {
      role: 'system' as const,
      content: systemPrompt,
    },
  ];
}
