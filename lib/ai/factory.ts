import type { AIProvider, AIProviderName } from '@/types/ai';
import { AIConfigurationError } from '@/types/errors';
import { NVIDIAProvider, type NVIDIAProviderOptions } from './providers/nvidia-provider';
import { GeminiProvider, type GeminiProviderOptions } from './providers/gemini-provider';

export type CreateAIProviderOptions = (NVIDIAProviderOptions | GeminiProviderOptions) & {
  provider?: AIProviderName;
};

/**
 * Factory that instantiates an AIProvider based on explicit configuration or environment variables.
 *
 * Rules:
 * - Reads AI_PROVIDER from env or options.
 * - Instantiates ONLY the requested provider.
 * - Does NOT validate or fail on missing credentials for unused providers.
 */
export function createAIProvider(options?: CreateAIProviderOptions): AIProvider {
  const providerName = (
    options?.provider ||
    process.env.AI_PROVIDER ||
    ''
  ).trim().toLowerCase() as AIProviderName;

  if (!providerName) {
    throw new AIConfigurationError(
      'AI provider is not configured. Set the AI_PROVIDER environment variable to "nvidia" or "gemini", or provide it in configuration.'
    );
  }

  if (providerName === 'nvidia') {
    return new NVIDIAProvider(options as NVIDIAProviderOptions);
  }

  if (providerName === 'gemini') {
    return new GeminiProvider(options as GeminiProviderOptions);
  }

  throw new AIConfigurationError(
    `Unsupported AI provider: "${providerName}". Supported providers are "nvidia" and "gemini".`
  );
}
