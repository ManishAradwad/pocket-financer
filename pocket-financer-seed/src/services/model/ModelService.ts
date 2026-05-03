/**
 * PLACEHOLDER — This file must be implemented before the pipeline can work.
 *
 * ModelService is a thin wrapper around llama.rn that provides:
 * - Loading a bundled GGUF model
 * - Running completions (prompt → text)
 * - Stopping completions mid-inference
 * - GPU layer configuration
 *
 * This is intentionally minimal: no model switching, no HF downloads,
 * no chat sessions, no streaming. The PocketPal ModelStore.ts (3054 lines)
 * at /mnt/c/pf/src/store/ModelStore.ts is the reference implementation.
 *
 * Expected methods:
 *
 *   async load(): Promise<void>
 *     Loads the bundled GGUF model into memory.
 *
 *   async complete(prompt: string, params: CompletionParams): Promise<string>
 *     Runs inference. Returns the model's text response.
 *     CompletionParams: { temperature, response_format?, n_predict }
 *
 *   stopCompletion(): void
 *     Aborts the current inference (called on timeout).
 *
 *   isLoaded(): boolean
 *     Returns true if the model is ready.
 *
 *   setGpuLayers(n: number): void
 *     Configures GPU layer offloading (99 = all, 0 = CPU only).
 *
 * Implementation notes:
 * - Uses llama.rn's initLlama() for model loading
 * - The GGUF file should be bundled in android/app/src/main/assets/
 *   or downloaded to the app's documents directory on first launch
 * - GPU acceleration requires Adreno GPU + i8mm + dotprod (checked by
 *   CapabilityDetectionService before calling setGpuLayers)
 * - The model path should point to a .gguf file
 */

// TODO: Replace this placeholder with actual implementation.
// The PipelineService imports from here:
//   import { modelService } from '../model/ModelService';

export const modelService = {
  async load(): Promise<void> {
    throw new Error('ModelService.load() not implemented');
  },

  async complete(_prompt: string, _params: any): Promise<string> {
    throw new Error('ModelService.complete() not implemented');
  },

  stopCompletion(): void {
    throw new Error('ModelService.stopCompletion() not implemented');
  },

  isLoaded(): boolean {
    return false;
  },

  setGpuLayers(_n: number): void {
    // no-op — will be configured when model loads
  },
};
