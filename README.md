# Document Summary Assistant

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-103%20Passing-brightgreen.svg?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade document intelligence and structured summarization platform engineered for precision, fault tolerance, and high performance. It processes native PDFs, scanned documents, and image formats using client-side extraction and browser-based OCR, hierarchically chunks content with sentence boundary preservation, and generates schema-validated structured summaries with verifiable page-level provenance through a swappable AI provider architecture.

---

## Live Demo

Live Application:
https://document-summary-assistant-nu-lilac.vercel.app/

Status:
Production deployment

---

## Repository

GitHub Repository:
https://github.com/ashlesh-l-g/document-summary-assistant

---

## Project Summary

Project:
Document Summary Assistant

Purpose:
AI-powered document analysis and structured summarization for PDFs and images.

Primary AI Provider:
Groq

AI Model:
openai/gpt-oss-20b

Framework:
Next.js

Language:
TypeScript

OCR:
Tesseract.js

PDF Processing:
PDF.js

---

## Requirements & Implementation Status

| Requirement | Implementation | Status |
|---|---|---|
| PDF upload | PDF.js client-side text stream parsing | Complete |
| Image upload | PNG, JPG, JPEG, WEBP formats | Complete |
| Browser OCR | Tesseract.js Web Worker integration | Complete |
| Structured AI summarization | Groq Chat Completions API + Zod schema validation | Complete |
| Summary detail levels | Short (~1,000 chars), Medium (~1,800 chars), Long (~2,800 chars) | Complete |
| Provenance tracking | Source page numbers and chunk ID mappings | Complete |
| Markdown export | One-click clipboard copy and .md file download | Complete |
| Production deployment | Vercel Serverless Platform | Complete |

---

## Deployment

Platform:
Vercel

Production URL:
https://document-summary-assistant-nu-lilac.vercel.app/

The application is deployed on the Vercel platform as a Next.js App Router application. The active AI provider credentials (`GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL`) are securely configured as server-side environment variables and are never exposed to client browsers.

---

## Overview

Document Summary Assistant bridges the gap between raw document ingestion and verified AI synthesis. Standard LLM summarizers often suffer from context truncation, hallucinated structure, missing provenance, and high server processing overhead. This platform resolves those challenges with a dedicated extraction, processing, and synthesis pipeline:

* **Multi-Format Ingestion**: Supports native digital PDFs (`.pdf`) as well as image documents (`.png`, `.jpg`, `.jpeg`, `.webp`).
* **Client-Side Extraction & OCR**: Extracts text from digital PDFs via PDF.js and falls back to client-side Tesseract.js OCR for scanned or image-based documents, eliminating heavy document rasterization on the backend.
* **Hierarchical Chunking**: Splits large documents into token-aware chunks along natural paragraph and sentence boundaries, avoiding fragmented context.
* **AI-Powered Structured Synthesis**: Generates rich executive overviews, key takeaways, thematic sections with specific findings, and page-level source citations.
* **Configurable Detail Levels**: Supports Short, Medium, and Long synthesis modes to tune granularity for executive briefs or detailed analytical reports.
* **Verifiable Provenance**: Retains direct trace links (page numbers and chunk IDs) for all key findings, allowing readers to verify claims against original sources.
* **Export & Interoperability**: Offers real-time Markdown preview, one-click clipboard copying, and GitHub Flavored Markdown (`.md`) file downloads.

---

## Why This Implementation

This architecture is built on deliberate production engineering decisions designed to optimize latency, scalability, security, and reliability:

1. **Edge-Friendly Client Extraction**: Document parsing and OCR occur directly in the browser via Web Workers. The server never handles compute-heavy image rasterization or massive raw binary streams, keeping serverless route execution fast, lightweight, and cost-effective.
2. **Zero Client-Side Secret Exposure**: AI API keys and model configurations are strictly encapsulated in server-side environment variables. The browser communicates solely with a secured internal API endpoint (`/api/documents/summarize`).
3. **Pluggable AI Provider Abstraction**: AI vendor logic is decoupled behind a unified `AIProvider` interface. Switching between providers (Groq, NVIDIA NIM, Gemini) requires only an environment variable change—no application refactoring.
4. **Defensive Schema Validation**: LLM outputs are never trusted blindly. Raw model responses pass through multi-strategy JSON extraction and strict Zod runtime schema validation before reaching application state.
5. **Adaptive Execution Fast-Path**: Single-chunk documents bypass intermediate chunk summarization, executing in a single LLM roundtrip. Multi-chunk documents utilize bounded concurrent worker pools with automatic retries.
6. **Production-Grade Reliability**: Includes bounded request timeouts (default 60s), bidirectional `AbortSignal` propagation, exponential backoff with jitter for transient rate limits (429) or server errors (5xx), and sanitized error responses that strip internal paths and credentials.

---

## Architecture

### Execution Flow

1. User uploads PDF or image in the browser.
2. Browser extracts text using PDF.js.
3. Low-text/scanned pages and images trigger client-side Tesseract.js OCR in a Web Worker.
4. Browser produces a normalized `ExtractedDocument` payload.
5. `ExtractedDocument` is sent via `POST /api/documents/summarize`.
6. Server processes and chunks the document along paragraph and sentence boundaries.
7. AI provider generates structured summaries (single-chunk fast path or concurrent `asyncPool`).
8. Zod schema validation verifies the AI output structure.
9. Provenance map links findings and sections to source pages and chunk IDs.
10. UI renders the structured summary, source badges, and supports Markdown copy/download.

### Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                BROWSER CLIENT                                    │
│                                                                                  │
│   ┌──────────────────────┐        ┌──────────────────────────────────────────┐   │
│   │ File Upload / Drop   │───────>│ Text & Structure Extraction              │   │
│   │ (.pdf, .png, .jpg)   │        │ - PDF.js (Native text streams)           │   │
│   └──────────────────────┘        │ - Tesseract.js (Web Worker OCR fallback) │   │
│                                   └────────────────────┬─────────────────────┘   │
└────────────────────────────────────────────────────────┼─────────────────────────┘
                                                         │ ExtractedDocument JSON
                                                         │ (HTTP POST /api/documents/summarize)
┌────────────────────────────────────────────────────────▼─────────────────────────┐
│                               NEXT.JS SERVER API                                 │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ Document Processing & Hierarchical Chunking                              │   │
│   │ - Sentence & paragraph boundary splitting                                │   │
│   │ - Overlap preservation & token estimation                                │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        │                                         │
│   ┌────────────────────────────────────▼─────────────────────────────────────┐   │
│   │ Summarization Coordinator                                                │   │
│   │ - Single-Chunk Fast Path (1 Synthesis Call)                              │   │
│   │ - Multi-Chunk Concurrent Processing Pool (asyncPool + withRetry)         │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        │                                         │
│   ┌────────────────────────────────────▼─────────────────────────────────────┐   │
│   │ AI Provider Abstraction (AIProvider Interface)                           │   │
│   │ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────┐   │   │
│   │ │  Groq Provider       │ │  NVIDIA NIM Provider │ │ Gemini Provider  │   │   │
│   │ │  (Active / Default)  │ │  (meta/llama-3.3)    │ │ (gemini-2.5)     │   │   │
│   │ └──────────┬───────────┘ └──────────────────────┘ └──────────────────┘   │   │
│   └────────────┼─────────────────────────────────────────────────────────────┘   │
└────────────────┼─────────────────────────────────────────────────────────────────┘
                 │ OpenAI-Compatible Chat Completion API
                 ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         GROQ INFERENCE CLOUD ENGINE                              │
│                         (openai/gpt-oss-20b)                                     │
└────────────────┬─────────────────────────────────────────────────────────────────┘
                 │ Raw Model Response
┌────────────────▼─────────────────────────────────────────────────────────────────┐
│ NEXT.JS SERVER VALIDATION LAYER                                                  │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ JSON Extractor & Zod Schema Validator                                    │   │
│   │ - Strips markdown code fences / extracts JSON object                     │   │
│   │ - Validates ChunkSummary & DocumentSummary schemas                       │   │
│   │ - Reconstructs page & chunk provenance map                               │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
└────────────────────────────────────────┼─────────────────────────────────────────┘
                                         │ Validated DocumentSummary JSON
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│ BROWSER CLIENT PRESENTATION                                                      │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ Interactive Results View                                                 │   │
│   │ - Executive Overview & Key Takeaways                                     │   │
│   │ - Thematic Sections with Page Badges & Key Findings                      │   │
│   │ - Source References Map                                                  │   │
│   │ - One-Click Markdown Copy & File Download (.md)                          │   │
│   └──────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Layer Responsibilities

1. **Client Ingestion Layer**: Handles file validation (up to 20MB), mime detection, and progress reporting across extraction stages.
2. **Extraction Engine**: Reads text streams natively from PDF objects or dynamically spins up a Tesseract.js OCR worker when text density falls below `DEFAULT_OCR_THRESHOLD` (50 characters per page).
3. **Application Orchestrator**: Manages workflow coordination (`summarizeDocumentFile` / `summarizeExtractedDocument`), translating domain errors to standardized HTTP responses.
4. **Hierarchical Chunker**: Splits text using token estimation (4 chars/token heuristic) while honoring sentence punctuation and paragraph breaks, maintaining configurable overlap to preserve context across boundaries.
5. **AI Provider Layer**: Isolates vendor-specific HTTP client logic, timeouts, headers, and model parameter formatting behind a standard interface.
6. **Validation & Provenance Layer**: Enforces Zod contract compliance, guaranteeing that downstream components always receive clean, strongly typed summaries with intact page references.

---

## AI Providers

### Active Production Provider

Active AI Provider:
Groq

Active Model:
openai/gpt-oss-20b

Base URL:
https://api.groq.com/openai/v1

Implementation:
`GroqProvider` in `lib/ai/providers/groq-provider.ts` utilizing Groq's OpenAI-compatible Chat Completions API with bounded request timeouts and AbortSignal propagation.

### Supported Alternative Providers

The codebase maintains full, production-tested implementations for alternative providers that can be activated by changing `AI_PROVIDER` in environment configuration:

* **NVIDIA NIM**: `meta/llama-3.3-70b-instruct` (`NVIDIAProvider` in `lib/ai/providers/nvidia-provider.ts`)
* **Google Gemini**: `gemini-2.5-flash` (`GeminiProvider` in `lib/ai/providers/gemini-provider.ts`)

---

## Key Engineering Decisions

### 1. Browser-Side Extraction & OCR
* **Rationale**: Server-side PDF rasterization and OCR require heavy native system binaries (e.g., Poppler, Tesseract C++ binaries, Ghostscript) and significant CPU/memory resources, leading to severe serverless bottlenecks.
* **Implementation**: Uses `pdfjs-dist` to parse native text layers directly in the browser. For scanned PDFs or images, `tesseract.js` executes inside a dedicated browser Web Worker. If a PDF page contains fewer than 50 characters of native text, it automatically triggers page-level OCR fallback.

### 2. Server-Safe Dynamic Import Isolation
* **Rationale**: In Node.js serverless runtimes (such as Vercel Functions), loading browser-targeted packages like `pdfjs-dist` at the top level causes runtime errors (e.g., `ReferenceError: DOMMatrix is not defined`).
* **Implementation**: The primary JSON API summarization path (`summarizeExtractedDocument`) imports only pure TypeScript validation and AI modules. File extraction is isolated behind dynamic imports (`import('@/lib/extraction/document-extractor')`), ensuring `pdfjs-dist` is never evaluated during serverless initialization or standard JSON summarization requests.

### 3. Provider Abstraction Architecture
* **Rationale**: Prevents vendor lock-in and allows seamless switching between LLM providers based on latency, cost, or availability constraints.
* **Implementation**: All providers implement the standard `AIProvider` contract:
  ```typescript
  export interface AIProvider {
    readonly name: AIProviderName;
    readonly modelName: string;
    summarizeChunk(request: ChunkSummaryRequest): Promise<ChunkSummary>;
    synthesizeSummary(request: DocumentSynthesisRequest): Promise<DocumentSummary>;
  }
  ```

### 4. Defensive Structured AI Validation
* **Rationale**: LLMs occasionally return markdown formatting, code fences, conversational preambles, or malformed schema keys.
* **Implementation**: Employs a multi-phase parsing pipeline:
  1. Direct `JSON.parse` attempt.
  2. Regex extraction targeting markdown code fences (````json ... ````).
  3. Balanced brace substring extraction (`{ ... }`).
  4. Comprehensive schema validation via **Zod** (`chunkSummaryResponseSchema`, `documentSynthesisResponseSchema`).
  5. Any structural violation immediately throws a typed `AIResponseValidationError` mapping to HTTP 502 (Bad Gateway).

### 5. Production Reliability & Fault Isolation
* **Bounded Timeouts**: All provider requests wrap fetch calls with `AbortController` and an explicit 60-second timer to eliminate hanging connections.
* **Client Cancellation Propagation**: When a user cancels a request or closes the browser tab, `req.signal` propagates through the pipeline to immediately abort upstream LLM calls and conserve compute quota.
* **Intelligent Retry Loop**: `withRetry` uses exponential backoff with jitter. Transient HTTP 429 (Rate Limit) and 5xx (Server Error) responses are retried up to 3 times; permanent failures (401 Auth, 403 Forbidden, 422 Invalid Input) fail fast without wasteful retries.
* **Error Sanitization**: `mapErrorToHttpResponse` intercepts all errors, redacting filesystem paths, internal URLs, and Bearer authorization tokens before returning safe error payloads to the client.

### 6. Performance Optimizations
* **Single-Chunk Fast Path**: When a document fits within a single chunk, intermediate chunk summarization is bypassed completely. The orchestrator executes exactly 1 synthesis LLM call, reducing latency by over 50%.
* **Concurrent Async Pool**: For multi-chunk documents, `asyncPool` executes chunk summarizations with bounded concurrency (default: 3 concurrent requests), maximizing throughput without triggering provider rate limits.
* **Minimal Over-The-Wire Payloads**: The browser uploads normalized text and metadata rather than multi-megabyte PDF binaries, reducing network transit time to milliseconds.

### 7. Strict Provenance Tracking
* **Rationale**: Enterprise document summaries must be verifiable against source pages to eliminate ungrounded hallucinations.
* **Implementation**: Every chunk preserves its `startPage`, `endPage`, and `pageNumbers` array. During synthesis, section headings and key findings link back to `sourcePages`, while `sourceReferences` record page numbers, chunk IDs, and relevance descriptions.

---

## Features

| Category | Feature | Description |
|---|---|---|
| **Ingestion** | Multi-Format Upload | Drag-and-drop or file browser upload for PDF, PNG, JPG, JPEG, and WEBP (up to 20MB). |
| **Ingestion** | Client-Side PDF Parsing | High-speed text and structure extraction via PDF.js. |
| **Ingestion** | Browser OCR Engine | Tesseract.js OCR in Web Workers for images and scanned PDF pages. |
| **Configuration** | Granularity Control | Toggle between Short (~1,000 char chunks), Medium (~1,800 chars), and Long (~2,800 chars). |
| **Summarization** | Executive Overview | High-level synthesis capturing document purpose and core conclusions. |
| **Summarization** | Key Takeaways | Bulleted executive highlights and major takeaways. |
| **Summarization** | Thematic Sections | Structured sections with headings, detailed narrative, and key findings. |
| **Provenance** | Page & Chunk Citations | Clickable page badges and explicit source reference listings. |
| **Export** | Markdown Interoperability | One-click clipboard copy and direct `.md` file download. |
| **UI & UX** | Real-Time Feedback | Multi-stage visual progress tracker (Reading → Extracting → Synthesizing → Complete). |
| **UI & UX** | Error Handling | Contextual error alerts with actionable resolution guidance. |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) | Full-stack architecture, React Server Components, route handlers |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Strict static typing, discriminated unions, comprehensive type contracts |
| **UI & Styling** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide](https://lucide.dev/) | Modern reactive components, utility styling, accessible iconography |
| **PDF Extraction** | [PDF.js (`pdfjs-dist`)](https://mozilla.github.io/pdf.js/) | Native PDF text stream and page metadata extraction |
| **OCR Processing** | [Tesseract.js](https://tesseract.projectnaptha.com/) | Client-side Optical Character Recognition via Web Workers |
| **Active AI Engine** | [Groq API](https://groq.com/) | Ultra-low latency OpenAI-compatible completions (`openai/gpt-oss-20b`) |
| **Alternative AI** | [NVIDIA NIM](https://build.nvidia.com/), [Google Gemini](https://ai.google.dev/) | Enterprise alternative providers (`meta/llama-3.3-70b`, `gemini-2.5-flash`) |
| **Schema Validation** | [Zod 4](https://zod.dev/) | Runtime contract validation for requests, extractions, and AI outputs |
| **Test Suite** | [Vitest 4](https://vitest.dev/) | Fast unit, integration, and provider test execution |

---

## Security

* **Server-Side API Key Encapsulation**: `GROQ_API_KEY` (and alternative keys) are stored purely as server-side environment variables and are never bundled into client assets.
* **No `NEXT_PUBLIC_` Key Leakage**: Client code contains no reference to AI provider credentials.
* **In-Memory Stream Processing**: Document text and chunk data are processed in memory during the request lifecycle and are not persisted to disk or external databases.
* **Sanitized Error Payloads**: Domain error messages are stripped of file system paths, internal IP addresses, and authentication tokens before being sent over HTTP.
* **Client-Side Compute Offloading**: Performing OCR in the browser prevents denial-of-service vulnerabilities and CPU exhaustion on serverless endpoints.

---

## Project Structure

```text
├── app/
│   ├── api/documents/summarize/route.ts  # Next.js API route handler (JSON / Multipart)
│   ├── globals.css                       # Tailwind CSS v4 styling definitions
│   ├── layout.tsx                        # Root HTML shell and metadata
│   └── page.tsx                          # Main single-page document summary application
│
├── components/
│   ├── error-alert.tsx                   # Accessible error banner component
│   ├── header.tsx                        # Navigation and branding header
│   ├── processing-state.tsx              # Multi-step extraction & synthesis progress
│   ├── summary-config.tsx                # Detail level selector (Short/Medium/Long)
│   ├── summary-result.tsx                # Structured summary viewer & provenance display
│   ├── upload-zone.tsx                   # Drag-and-drop document dropzone
│   └── ui/                               # Reusable primitives (buttons, badges)
│
├── lib/
│   ├── ai/
│   │   ├── factory.ts                    # Dynamic provider factory (Groq, NVIDIA, Gemini)
│   │   ├── prompts/                      # Chunk summary and document synthesis prompts
│   │   ├── providers/                    # Groq, NVIDIA, and Gemini provider implementations
│   │   ├── summarization/                # Summarization service (fast-path + asyncPool)
│   │   └── utils/                        # Concurrency pool and exponential backoff retry
│   ├── application/
│   │   ├── document-summarizer.ts        # Top-level application orchestration service
│   │   └── error-mapper.ts               # Domain-to-HTTP status code mapper & sanitizer
│   ├── extraction/
│   │   ├── document-extractor.ts         # PDF extraction with OCR threshold fallback
│   │   ├── image-extractor.ts            # Standalone image OCR extractor
│   │   ├── ocr-extractor.ts              # Tesseract.js worker integration
│   │   ├── pdf-extractor.ts              # PDF.js text stream reader
│   │   └── text-normalizer.ts            # Whitespace and hyphenation normalizer
│   ├── processing/
│   │   ├── chunker.ts                    # Token-aware hierarchical sentence chunker
│   │   └── token-counter.ts              # Token estimation utility
│   ├── validation/
│   │   ├── ai-validation.ts              # Zod schemas for AI JSON responses
│   │   ├── document-validation.ts        # Extracted document contract validation
│   │   └── file-validation.ts            # File size, magic bytes, and type validation
│   ├── format-utils.ts                   # Number and byte formatting helpers
│   └── markdown-export.ts                # GitHub Flavored Markdown serializer
│
├── tests/
│   ├── ai-factory.test.ts                # Provider factory resolution tests
│   ├── api-summarize.test.ts             # API route validation and error mapping tests
│   ├── extraction.test.ts                # PDF and text normalization tests
│   ├── groq-provider.test.ts             # Groq provider mock & error handling tests
│   ├── nvidia-provider.test.ts           # NVIDIA NIM provider mock tests
│   ├── gemini-provider.test.ts           # Gemini provider mock tests
│   ├── processing.test.ts                # Chunking and sentence boundary tests
│   ├── summarization-service.test.ts     # Concurrency, fast-path, and retry tests
│   └── validation.test.ts                # File and schema validation tests
│
└── types/
    ├── ai.ts                             # Provider, ChunkSummary, and DocumentSummary types
    ├── api.ts                            # HTTP request and response payload schemas
    ├── document.ts                       # ExtractedDocument and page representations
    ├── errors.ts                         # Typed domain error hierarchy
    └── processing.ts                     # ProcessedDocument and DocumentChunk types
```

---

## Getting Started

### Prerequisites

* **Node.js**: v18.18+ or v20+
* **Package Manager**: `npm` (v9+)
* **AI Provider API Key**: [Groq Console API Key](https://console.groq.com/) *(or NVIDIA NIM / Google Gemini key)*

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ashlesh-l-g/document-summary-assistant.git
   cd document-summary-assistant
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Environment Configuration

Copy the sample environment file to `.env.local`:

```bash
cp .env.example .env.local
```

Configure your active provider credentials in `.env.local`:

```env
# AI Provider Selection (Options: groq | nvidia | gemini)
AI_PROVIDER=groq

# Groq Configuration (Active Provider)
# https://console.groq.com/
GROQ_API_KEY=gsk_your_actual_groq_api_key
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=openai/gpt-oss-20b

# NVIDIA NIM Configuration (Optional)
NVIDIA_API_KEY=
NVIDIA_MODEL=meta/llama-3.3-70b-instruct

# Google Gemini Configuration (Optional)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

### Running the Application

Start the local Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing & Quality Assurance

The codebase includes comprehensive unit and integration test suites verifying extraction, chunking, provider abstractions, error handling, and API routes:

```bash
# Run full Vitest test suite (103 tests)
npm test

# Run TypeScript typecheck
npx tsc --noEmit

# Run ESLint check
npm run lint

# Build production bundle
npm run build
```

---

## Submission

Live Application:
https://document-summary-assistant-nu-lilac.vercel.app/

GitHub Repository:
https://github.com/ashlesh-l-g/document-summary-assistant

Technology:
Next.js, TypeScript, React, PDF.js, Tesseract.js, Groq

Purpose:
Technical assessment implementation demonstrating document extraction, OCR, AI summarization, structured validation, provenance tracking, reliability handling, and production deployment.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
