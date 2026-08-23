import type { ChunkSummaryRequest } from '@/types/ai';

export interface PromptPayload {
  readonly systemPrompt: string;
  readonly userPrompt: string;
}

/**
 * Builds deterministic prompt instructions for summarizing a single document chunk
 */
export function buildChunkSummaryPrompt(request: ChunkSummaryRequest): PromptPayload {
  const { chunk, documentTitle } = request;

  const systemPrompt = `You are a precise, analytical document summarization assistant.
Your task is to analyze an excerpt from a document and generate a structured, factual summary.

RULES:
1. Rely ONLY on the provided text. Do NOT assume, extrapolate, or invent information.
2. Extract the core summary and bulleted key points accurately.
3. Identify 2 to 5 overarching topics or themes discussed in the chunk.
4. You MUST respond with a valid, raw JSON object conforming EXACTLY to this JSON schema:

{
  "summary": "A clear, concise 2-4 sentence narrative summary of the chunk's content.",
  "keyPoints": [
    "Key factual point 1 with specific details, numbers, or assertions",
    "Key factual point 2"
  ],
  "topics": [
    "Topic 1",
    "Topic 2"
  ]
}

Do not include any conversational filler, markdown commentary, or preambles outside the JSON object.`;

  const docContext = documentTitle ? `Document: "${documentTitle}"\n` : '';
  const pageRange =
    chunk.startPage === chunk.endPage
      ? `Page ${chunk.startPage}`
      : `Pages ${chunk.startPage}-${chunk.endPage}`;

  const userPrompt = `${docContext}Chunk ID: ${chunk.id} (${pageRange})

=== DOCUMENT EXCERPT START ===
${chunk.text}
=== DOCUMENT EXCERPT END ===

Generate the structured JSON summary for this excerpt:`;

  return {
    systemPrompt,
    userPrompt,
  };
}
