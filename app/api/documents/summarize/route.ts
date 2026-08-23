import { NextRequest, NextResponse } from 'next/server';
import {
  summarizeDocumentFile,
  summarizeExtractedDocument,
} from '@/lib/application/document-summarizer';
import { mapErrorToHttpResponse } from '@/lib/application/error-mapper';
import { EmptyExtractionError, EmptyFileError } from '@/types/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s max execution on serverless

/**
 * POST /api/documents/summarize
 *
 * Supported request formats:
 * 1. application/json (Preferred production path from client-side PDF.js/Tesseract extraction):
 *    {
 *      "extractedDocument": ExtractedDocument,
 *      "options": SummarizeExtractedDocumentOptions
 *    }
 *
 * 2. multipart/form-data (Compatibility path for native PDF server extraction):
 *    Field: "file" (PDF blob)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Path 1: JSON payload with pre-extracted document (Browser PDF.js / Tesseract OCR)
    if (contentType.includes('application/json')) {
      let body: Record<string, unknown> | null = null;
      try {
        body = await req.json();
      } catch {
        const errorResult = mapErrorToHttpResponse(
          new EmptyExtractionError('Invalid JSON in request body.')
        );
        return NextResponse.json(errorResult.body, { status: errorResult.status });
      }

      const extractedDoc = (body?.extractedDocument || body?.document) as unknown as Parameters<typeof summarizeExtractedDocument>[0];
      if (!extractedDoc) {
        const errorResult = mapErrorToHttpResponse(
          new EmptyExtractionError('Missing "extractedDocument" in JSON request body.')
        );
        return NextResponse.json(errorResult.body, { status: errorResult.status });
      }

      const options = body?.options as
        | {
            processingOptions?: Parameters<typeof summarizeExtractedDocument>[1] extends { processingOptions?: infer P } ? P : never;
            aiOptions?: { maxConcurrency?: number; maxRetries?: number; retryDelayMs?: number; temperature?: number };
          }
        | undefined;

      const result = await summarizeExtractedDocument(extractedDoc, {
        processingOptions: options?.processingOptions,
        aiOptions: {
          ...options?.aiOptions,
          signal: req.signal,
        },
      });

      return NextResponse.json(result, { status: 200 });
    }

    // Path 2: multipart/form-data file upload (Server native PDF extraction)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const fileEntry = formData.get('file');

      if (!fileEntry || !(fileEntry instanceof Blob)) {
        const errorResult = mapErrorToHttpResponse(
          new EmptyFileError('Missing "file" field in upload request.')
        );
        return NextResponse.json(errorResult.body, { status: errorResult.status });
      }

      const result = await summarizeDocumentFile(fileEntry, {
        aiOptions: {
          signal: req.signal,
        },
      });

      return NextResponse.json(result, { status: 200 });
    }

    // Unsupported Content-Type
    const errorResult = mapErrorToHttpResponse(
      new EmptyFileError(
        'Unsupported Content-Type. Request must be application/json with "extractedDocument" or multipart/form-data with "file".'
      )
    );
    return NextResponse.json(errorResult.body, { status: errorResult.status });
  } catch (err: unknown) {
    const errorResult = mapErrorToHttpResponse(err);
    return NextResponse.json(errorResult.body, { status: errorResult.status });
  }
}
