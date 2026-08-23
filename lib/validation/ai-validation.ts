import { z } from 'zod';
import { AIResponseValidationError } from '@/types/errors';
import type {
  ChunkSummary,
  DocumentSummary,
  ChunkSummaryRequest,
  DocumentSynthesisRequest,
  AIProviderName,
} from '@/types/ai';

/**
 * Zod schema for model chunk summary JSON payload
 */
export const chunkSummaryResponseSchema = z.object({
  summary: z.string().min(1, 'Chunk summary must not be empty'),
  keyPoints: z
    .array(z.string().min(1))
    .min(1, 'Chunk must contain at least 1 key point'),
  topics: z.array(z.string()).optional(),
});

/**
 * Zod schema for individual synthesis section
 */
export const summarySectionSchema = z.object({
  heading: z.string().min(1, 'Section heading must not be empty'),
  content: z.string().min(1, 'Section content must not be empty'),
  sourcePages: z.array(z.number().int().positive()).optional(),
  keyFindings: z.array(z.string()).optional(),
});

/**
 * Zod schema for source references
 */
export const sourceReferenceSchema = z.object({
  pageNumber: z.number().int().positive(),
  chunkId: z.string().min(1),
  relevance: z.string().optional(),
  quote: z.string().optional(),
});

/**
 * Zod schema for synthesized document summary JSON payload
 */
export const documentSynthesisResponseSchema = z.object({
  title: z.string().min(1, 'Document title must not be empty'),
  overview: z.string().min(1, 'Document overview must not be empty'),
  keyPoints: z
    .array(z.string().min(1))
    .min(1, 'Document summary must contain at least 1 key point'),
  sections: z
    .array(summarySectionSchema)
    .min(1, 'Document summary must contain at least 1 section'),
  sourceReferences: z.array(sourceReferenceSchema).optional(),
});

/**
 * Cleanly extracts a JSON object from raw model text, stripping markdown code fences or conversational text
 */
export function extractJsonFromText(rawText: string, providerName?: string): unknown {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new AIResponseValidationError('Model returned an empty response.', {
      provider: providerName,
      snippet: '<empty>',
    });
  }

  const trimmed = rawText.trim();

  // 1. Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to pattern extraction
  }

  // 2. Extract from markdown code fence ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Continue to bracket search
    }
  }

  // 3. Extract substring between first '{' and last '}'
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSubstring);
    } catch (err) {
      throw new AIResponseValidationError(
        'Failed to parse JSON object from model response.',
        {
          provider: providerName,
          snippet: trimmed.slice(0, 200),
          cause: err,
        }
      );
    }
  }

  throw new AIResponseValidationError(
    'No valid JSON object structure found in model output.',
    {
      provider: providerName,
      snippet: trimmed.slice(0, 200),
    }
  );
}

/**
 * Parse and validate chunk summary model response
 */
export function parseAndValidateChunkSummary(
  rawText: string,
  request: ChunkSummaryRequest,
  providerName?: string
): ChunkSummary {
  const json = extractJsonFromText(rawText, providerName);
  const result = chunkSummaryResponseSchema.safeParse(json);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new AIResponseValidationError(
      `Chunk summary failed schema validation: ${issues}`,
      {
        provider: providerName,
        validationErrors: result.error.issues,
        snippet: rawText.slice(0, 200),
      }
    );
  }

  const chunk = request.chunk;

  return {
    chunkId: chunk.id,
    startPage: chunk.startPage,
    endPage: chunk.endPage,
    pageNumbers: chunk.pageNumbers,
    summary: result.data.summary.trim(),
    keyPoints: result.data.keyPoints.map((kp) => kp.trim()),
    topics: result.data.topics?.map((t) => t.trim()),
  };
}

/**
 * Parse and validate document synthesis model response
 */
export function parseAndValidateDocumentSummary(
  rawText: string,
  request: DocumentSynthesisRequest,
  providerInfo: { provider: AIProviderName; model: string }
): DocumentSummary {
  const json = extractJsonFromText(rawText, providerInfo.provider);
  const result = documentSynthesisResponseSchema.safeParse(json);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new AIResponseValidationError(
      `Document synthesis failed schema validation: ${issues}`,
      {
        provider: providerInfo.provider,
        validationErrors: result.error.issues,
        snippet: rawText.slice(0, 200),
      }
    );
  }

  const data = result.data;
  const chunkSummaries = request.chunkSummaries;

  // Aggregate page count & provenance
  const allPages = Array.from(
    new Set(chunkSummaries.flatMap((c) => c.pageNumbers))
  ).sort((a, b) => a - b);
  const totalPages = request.documentMetadata?.pageCount ?? (allPages.length > 0 ? allPages[allPages.length - 1] : 1);

  // Fallback source references if model didn't generate them
  const sourceReferences =
    data.sourceReferences && data.sourceReferences.length > 0
      ? data.sourceReferences
      : chunkSummaries.map((c) => ({
          pageNumber: c.startPage,
          chunkId: c.chunkId,
          relevance: `Source content for chunk ${c.chunkId} spanning pages ${c.startPage}-${c.endPage}`,
        }));

  return {
    title: data.title.trim(),
    overview: data.overview.trim(),
    keyPoints: data.keyPoints.map((k) => k.trim()),
    sections: data.sections.map((s) => ({
      heading: s.heading.trim(),
      content: s.content.trim(),
      sourcePages: s.sourcePages || [],
      keyFindings: s.keyFindings || [],
    })),
    sourceReferences,
    metadata: {
      pageCount: totalPages,
      totalChunks: chunkSummaries.length,
      provider: providerInfo.provider,
      model: providerInfo.model,
      generatedAt: new Date().toISOString(),
      fileName: request.documentMetadata?.fileName,
      fileSizeBytes: request.documentMetadata?.fileSizeBytes,
      isScanned: request.documentMetadata?.isScanned,
    },
  };
}
