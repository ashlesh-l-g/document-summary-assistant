import type { DocumentSynthesisRequest } from '@/types/ai';
import type { PromptPayload } from './chunk-summary-prompt';

/**
 * Builds deterministic prompt instructions for synthesizing chunk summaries into a cohesive document summary
 */
export function buildDocumentSynthesisPrompt(request: DocumentSynthesisRequest): PromptPayload {
  const { chunkSummaries, documentTitle, documentMetadata } = request;

  const systemPrompt = `You are an expert executive document analyst and synthesizer.
Your task is to review summary excerpts from different parts of a document and synthesize them into a comprehensive, cohesive, professional document summary.

RULES:
1. Synthesize the information logically. Deduplicate overlapping points from different chunks.
2. Formulate a concise, clear title if one is not provided.
3. Write a high-level executive overview (1-2 paragraphs).
4. Extract 4 to 8 primary, high-impact key points across the entire document.
5. Create logical thematic sections with headings, structured narrative content, key findings, and referenced source pages.
6. Populate source references linking chunks and pages back to their source context.
7. You MUST respond with a valid, raw JSON object conforming EXACTLY to this JSON schema:

{
  "title": "Document Title",
  "overview": "Comprehensive executive overview of the entire document...",
  "keyPoints": [
    "High-impact key takeaway 1",
    "High-impact key takeaway 2"
  ],
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Detailed synthesis of this topic area...",
      "sourcePages": [1, 2],
      "keyFindings": ["Finding 1", "Finding 2"]
    }
  ],
  "sourceReferences": [
    {
      "pageNumber": 1,
      "chunkId": "chunk-0",
      "relevance": "Brief explanation of source context"
    }
  ]
}

Do not include any text, markdown commentary, or preambles outside the raw JSON object.`;

  const docContext = documentTitle
    ? `Document Title: ${documentTitle}\n`
    : documentMetadata?.fileName
    ? `File Name: ${documentMetadata.fileName}\n`
    : '';

  const chunksFormatted = chunkSummaries
    .map((c) => {
      const pageInfo =
        c.startPage === c.endPage
          ? `Page ${c.startPage}`
          : `Pages ${c.startPage}-${c.endPage}`;
      const points = c.keyPoints.map((p) => `  * ${p}`).join('\n');
      return `[Chunk ID: ${c.chunkId} | ${pageInfo}]
Summary: ${c.summary}
Key Points:
${points}`;
    })
    .join('\n\n---\n\n');

  const userPrompt = `${docContext}Total Chunks to Synthesize: ${chunkSummaries.length}

=== CHUNK SUMMARIES START ===
${chunksFormatted}
=== CHUNK SUMMARIES END ===

Synthesize these chunk summaries into the final structured document summary JSON:`;

  return {
    systemPrompt,
    userPrompt,
  };
}
