import { z } from 'zod';
import { EmptyExtractionError } from '@/types/errors';
import type { ExtractedDocument } from '@/types/document';

export const extractedPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  method: z.enum(['native', 'ocr']),
  charCount: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(100).optional(),
  isScanned: z.boolean().optional(),
});

export const documentMetadataSchema = z.object({
  pageCount: z.number().int().positive(),
  fileName: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  creator: z.string().optional(),
  producer: z.string().optional(),
  creationDate: z.string().optional(),
  isScanned: z.boolean().optional(),
});

export const extractedDocumentSchema = z.object({
  text: z.string().min(1, 'Extracted text must not be empty'),
  pages: z.array(extractedPageSchema).min(1, 'Document must contain at least 1 page'),
  method: z.enum(['native', 'ocr', 'mixed']),
  metadata: documentMetadataSchema,
  totalCharCount: z.number().int().positive('Total character count must be greater than 0'),
  warning: z.string().optional(),
});

/**
 * Validate an extracted document object and assert that non-empty text was recovered
 */
export function validateExtractedDocument(data: unknown): ExtractedDocument {
  const result = extractedDocumentSchema.safeParse(data);

  if (!result.success) {
    // If text is empty or blank
    const textIssues = result.error.issues.filter(
      (i) => i.path.includes('text') || i.path.includes('totalCharCount')
    );
    if (textIssues.length > 0) {
      throw new EmptyExtractionError(
        'No readable text could be extracted from the document. The document may be blank, corrupt, or unsupported.',
        { validationErrors: result.error.issues }
      );
    }

    throw new Error(
      `Extraction result validation failed: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
    );
  }

  // Also verify that the text isn't purely whitespace
  if (result.data.text.trim().length === 0) {
    throw new EmptyExtractionError(
      'Document text contains only whitespace. No readable content found.'
    );
  }

  return result.data as ExtractedDocument;
}
