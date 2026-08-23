import { GoogleGenAI } from '@google/genai';
import type {
  AIProvider,
  AIProviderName,
  ChunkSummary,
  DocumentSummary,
  ChunkSummaryRequest,
  DocumentSynthesisRequest,
  AIProviderConfig,
} from '@/types/ai';
import {
  AIAuthenticationError,
  AIConfigurationError,
  AIProviderError,
  AIRateLimitError,
} from '@/types/errors';
import {
  parseAndValidateChunkSummary,
  parseAndValidateDocumentSummary,
} from '@/lib/validation/ai-validation';
import {
  buildChunkSummaryPrompt,
  buildDocumentSynthesisPrompt,
} from '@/lib/ai/prompts';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export interface GeminiClientLike {
  models: {
    generateContent: (params: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        responseMimeType?: string;
        temperature?: number;
        maxOutputTokens?: number;
        abortSignal?: AbortSignal;
      };
    }) => Promise<{ text?: string | null }>;
  };
}

export interface GeminiProviderOptions extends Partial<AIProviderConfig> {
  readonly customClient?: GeminiClientLike;
}

export class GeminiProvider implements AIProvider {
  readonly name: AIProviderName = 'gemini';
  readonly modelName: string;
  private readonly client: GeminiClientLike;

  constructor(options?: GeminiProviderOptions) {
    this.modelName = options?.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

    if (options?.customClient) {
      this.client = options.customClient;
      return;
    }

    const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim().length === 0) {
      throw new AIConfigurationError(
        'Gemini API key is missing. Set GEMINI_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.client = new GoogleGenAI({ apiKey: apiKey.trim() });
  }

  private async generateStructuredContent(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxOutputTokens?: number; signal?: AbortSignal }
  ): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxOutputTokens ?? 4096,
          abortSignal: options?.signal,
        },
      });

      const text = response?.text;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AIProviderError(
          'Gemini API returned empty text response.',
          this.name,
          { isRetryable: false }
        );
      }

      return text;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      const lower = errorMessage.toLowerCase();

      // Check authentication errors
      if (
        lower.includes('api_key_invalid') ||
        lower.includes('unauthenticated') ||
        lower.includes('invalid api key') ||
        lower.includes('401') ||
        lower.includes('403')
      ) {
        throw new AIAuthenticationError(
          'Gemini API authentication failed. Verify that your GEMINI_API_KEY is valid.',
          this.name,
          { cause: err }
        );
      }

      // Check rate limit / quota errors
      if (
        lower.includes('resource_exhausted') ||
        lower.includes('rate limit') ||
        lower.includes('quota') ||
        lower.includes('429')
      ) {
        throw new AIRateLimitError(
          'Gemini API quota or rate limit exceeded.',
          this.name,
          { cause: err }
        );
      }

      // Check transient errors
      const isRetryable =
        lower.includes('503') ||
        lower.includes('500') ||
        lower.includes('unavailable') ||
        lower.includes('overloaded') ||
        lower.includes('deadline_exceeded');

      throw new AIProviderError(
        `Gemini API generation failed: ${errorMessage}`,
        this.name,
        {
          isRetryable,
          details: { model: this.modelName },
          cause: err,
        }
      );
    }
  }

  async summarizeChunk(request: ChunkSummaryRequest): Promise<ChunkSummary> {
    const { systemPrompt, userPrompt } = buildChunkSummaryPrompt(request);
    const rawContent = await this.generateStructuredContent(
      systemPrompt,
      userPrompt,
      request.options
    );

    return parseAndValidateChunkSummary(rawContent, request, this.name);
  }

  async synthesizeSummary(request: DocumentSynthesisRequest): Promise<DocumentSummary> {
    const { systemPrompt, userPrompt } = buildDocumentSynthesisPrompt(request);
    const rawContent = await this.generateStructuredContent(
      systemPrompt,
      userPrompt,
      request.options
    );

    return parseAndValidateDocumentSummary(rawContent, request, {
      provider: this.name,
      model: this.modelName,
    });
  }
}
