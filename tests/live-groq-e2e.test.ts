import { describe, it, expect } from 'vitest';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { GroqProvider } from '@/lib/ai/providers/groq-provider';
import { POST } from '@/app/api/documents/summarize/route';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

describe('Live Groq API & End-to-End Verification', () => {
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0);

  it('verifies environment configuration', () => {
    console.log('--- Environment Check ---');
    console.log('AI_PROVIDER:', process.env.AI_PROVIDER);
    console.log('GROQ_API_KEY configured:', hasGroqKey);
    console.log('GROQ_MODEL:', process.env.GROQ_MODEL || 'openai/gpt-oss-20b');
    console.log('GROQ_BASE_URL:', process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1');
  });

  it.skipIf(!hasGroqKey)('performs direct live Groq API request', async () => {
    const provider = new GroqProvider();
    const startTime = performance.now();

    const result = await provider.summarizeChunk({
      chunk: {
        id: 'chunk-0',
        index: 0,
        text: 'Ashlesh is a Senior Software Engineer with 7+ years of experience in distributed systems, TypeScript, Next.js, React, and AI integrations.',
        startPage: 1,
        endPage: 1,
        pageNumbers: [1],
        charCount: 154,
        approximateTokenCount: 35,
      },
      documentTitle: 'Candidate CV',
      options: { temperature: 0.2 },
    });

    const latencyMs = Math.round(performance.now() - startTime);
    console.log('\n--- Direct Groq Live Request ---');
    console.log(`Latency: ${latencyMs} ms`);
    console.log('Result:', JSON.stringify(result, null, 2));

    expect(result.chunkId).toBe('chunk-0');
    expect(result.summary).toBeTruthy();
    expect(result.keyPoints.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!hasGroqKey)('performs end-to-end summarize document through POST /api/documents/summarize', async () => {
    const pdfPath = path.join(process.cwd(), 'ai-test.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const file = new File([pdfBuffer], 'ai-test.pdf', { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/documents/summarize', {
      method: 'POST',
      body: formData,
    });

    const startTime = performance.now();
    const res = await POST(req);
    const latencyMs = Math.round(performance.now() - startTime);

    expect(res.status).toBe(200);
    const json = await res.json();

    console.log('\n--- End-to-End POST /api/documents/summarize ---');
    console.log(`HTTP Status: ${res.status}`);
    console.log(`Latency: ${latencyMs} ms`);
    console.log('Document Title:', json.summary?.title);
    console.log('Document Overview:', json.summary?.overview);
    console.log('Key Points:', json.summary?.keyPoints);
    console.log('Sections count:', json.summary?.sections?.length);
    console.log('Metadata Provider:', json.summary?.metadata?.provider);
    console.log('Metadata Model:', json.summary?.metadata?.model);

    expect(json.success).toBe(true);
    expect(json.summary).toBeDefined();
    expect(json.summary.title).toBeTruthy();
    expect(json.summary.overview).toBeTruthy();
    expect(json.summary.keyPoints.length).toBeGreaterThan(0);
    expect(json.summary.sections.length).toBeGreaterThan(0);
    expect(json.summary.metadata.provider).toBe('groq');
  });
});
