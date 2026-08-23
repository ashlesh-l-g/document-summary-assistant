import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAIProvider } from '@/lib/ai/factory';
import { NVIDIAProvider } from '@/lib/ai/providers/nvidia-provider';
import { GeminiProvider } from '@/lib/ai/providers/gemini-provider';
import { AIConfigurationError } from '@/types/errors';

describe('AI Provider Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws AIConfigurationError when AI_PROVIDER is missing', () => {
    expect(() => createAIProvider()).toThrow(AIConfigurationError);
    expect(() => createAIProvider()).toThrow(/AI provider is not configured/);
  });

  it('throws AIConfigurationError for unsupported providers', () => {
    expect(() =>
      createAIProvider({ provider: 'openai' as unknown as 'nvidia' })
    ).toThrow(AIConfigurationError);
    expect(() =>
      createAIProvider({ provider: 'anthropic' as unknown as 'nvidia' })
    ).toThrow(/Unsupported AI provider/);
  });

  it('instantiates NVIDIAProvider when AI_PROVIDER is nvidia and key is present', () => {
    process.env.AI_PROVIDER = 'nvidia';
    process.env.NVIDIA_API_KEY = 'nv-test-key-12345';

    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(NVIDIAProvider);
    expect(provider.name).toBe('nvidia');
  });

  it('throws AIConfigurationError when NVIDIA is selected without NVIDIA_API_KEY', () => {
    process.env.AI_PROVIDER = 'nvidia';
    delete process.env.NVIDIA_API_KEY;

    expect(() => createAIProvider()).toThrow(AIConfigurationError);
    expect(() => createAIProvider()).toThrow(/NVIDIA API key is missing/);
  });

  it('instantiates GeminiProvider when AI_PROVIDER is gemini and key is present', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'gemini-test-key-12345';

    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.name).toBe('gemini');
  });

  it('throws AIConfigurationError when Gemini is selected without GEMINI_API_KEY', () => {
    process.env.AI_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;

    expect(() => createAIProvider()).toThrow(AIConfigurationError);
    expect(() => createAIProvider()).toThrow(/Gemini API key is missing/);
  });

  it('does NOT fail when unused provider credentials are missing', () => {
    // When NVIDIA is selected, missing GEMINI_API_KEY must not cause failure
    process.env.AI_PROVIDER = 'nvidia';
    process.env.NVIDIA_API_KEY = 'nv-test-key';
    delete process.env.GEMINI_API_KEY;

    const nvidiaProvider = createAIProvider();
    expect(nvidiaProvider.name).toBe('nvidia');

    // When Gemini is selected, missing NVIDIA_API_KEY must not cause failure
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    delete process.env.NVIDIA_API_KEY;

    const geminiProvider = createAIProvider();
    expect(geminiProvider.name).toBe('gemini');
  });
});
