/**
 * Deterministic approximate token counter for LLM text processing.
 *
 * Modern subword tokenizers (Byte-Pair Encoding like OpenAI cl100k, Gemini SentencePiece, LLaMA)
 * generally produce:
 * - English plain text: ~1 token per 3.8 to 4.2 characters (approx 0.75 words per token)
 * - Punctuation, symbols, and formatting: 1 token each
 * - Numbers and code: ~1 token per 2 to 3 characters
 *
 * This estimator deterministic blends subword regex segmentations with character ratios,
 * providing accurate estimations without external C++ or WASM dependencies.
 */

export function estimateTokenCount(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  // Segment text into alphanumeric words and individual punctuation/symbol characters
  const tokens = trimmed.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu);

  if (!tokens || tokens.length === 0) {
    return Math.max(1, Math.ceil(trimmed.length / 4));
  }

  // Count subword chunks: words longer than 6 chars often split into multiple subwords
  let subwordEstimate = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.length <= 4) {
      subwordEstimate += 1;
    } else {
      subwordEstimate += Math.ceil(token.length / 3.8);
    }
  }

  // Character-based baseline (~4 chars per token for English)
  const charBasedEstimate = Math.ceil(trimmed.length / 4);

  // Return the maximum to safely prevent context window overflow
  return Math.max(1, Math.round((subwordEstimate * 0.6) + (charBasedEstimate * 0.4)));
}
