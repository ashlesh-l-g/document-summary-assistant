import type { ExtractedDocument } from '@/types/document';
import type {
  ProcessedDocument,
  ProcessingOptions,
} from '@/types/processing';
import { EmptyDocumentProcessingError } from '@/types/errors';
import { validateProcessingOptions } from '@/lib/validation/processing-validation';
import { decomposePageIntoUnits, createChunksFromUnits, type TextUnit } from './chunker';

/**
 * Process an ExtractedDocument into LLM-ready, page-annotated, deterministic chunks
 */
export function processDocument(
  extractedDoc: ExtractedDocument,
  options?: ProcessingOptions
): ProcessedDocument {
  if (!extractedDoc || !extractedDoc.pages || extractedDoc.pages.length === 0) {
    throw new EmptyDocumentProcessingError(
      'Cannot process document: Extracted document contains no pages.'
    );
  }

  const rawText = extractedDoc.text ? extractedDoc.text.trim() : '';
  if (rawText.length === 0) {
    throw new EmptyDocumentProcessingError(
      'Cannot process document: Extracted document text is empty.'
    );
  }

  // 1. Validate and resolve configuration options
  const resolvedOptions = validateProcessingOptions(options);

  // 2. Decompose all pages hierarchically into atomic units
  const allUnits: TextUnit[] = [];
  for (let i = 0; i < extractedDoc.pages.length; i++) {
    const page = extractedDoc.pages[i];
    if (page.text && page.text.trim().length > 0) {
      const pageUnits = decomposePageIntoUnits(page, resolvedOptions.maxChunkSize);
      allUnits.push(...pageUnits);
    }
  }

  if (allUnits.length === 0) {
    throw new EmptyDocumentProcessingError(
      'No text units could be generated from the document pages.'
    );
  }

  // 3. Assemble units into deterministic chunks with overlap & page metadata
  const chunks = createChunksFromUnits(allUnits, resolvedOptions);

  if (chunks.length === 0) {
    throw new EmptyDocumentProcessingError(
      'Chunking produced 0 chunks from the extracted document.'
    );
  }

  // 4. Calculate aggregate statistics
  const totalCharCount = chunks.reduce((acc, chunk) => acc + chunk.charCount, 0);
  const totalApproximateTokens = chunks.reduce(
    (acc, chunk) => acc + chunk.approximateTokenCount,
    0
  );

  return {
    chunks,
    totalChunks: chunks.length,
    totalCharCount,
    totalApproximateTokens,
    metadata: extractedDoc.metadata,
    method: extractedDoc.method,
    processingOptions: resolvedOptions,
  };
}
