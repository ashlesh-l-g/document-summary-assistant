import { NextRequest, NextResponse } from 'next/server';
import { summarizeDocumentFile } from '@/lib/application/document-summarizer';
import { mapErrorToHttpResponse } from '@/lib/application/error-mapper';
import { EmptyFileError } from '@/types/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s max execution on serverless

/**
 * POST /api/documents/summarize
 *
 * Accepts multipart/form-data with a PDF file, extracts and processes content,
 * generates a structured summary via the configured AI provider, and returns
 * the structured DocumentSummary.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      const errorResult = mapErrorToHttpResponse(
        new EmptyFileError('Request must be multipart/form-data containing a "file" field.')
      );
      return NextResponse.json(errorResult.body, { status: errorResult.status });
    }

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
  } catch (err: unknown) {
    const errorResult = mapErrorToHttpResponse(err);
    return NextResponse.json(errorResult.body, { status: errorResult.status });
  }
}
