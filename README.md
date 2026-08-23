# Document Summary Assistant

A production-ready technical assessment application designed to extract text from documents (via PDF.js and Tesseract.js OCR) in the browser, send the text to a secure Next.js API route, and generate structured summaries using Gemini 2.5 Flash.

## Project Purpose

Document Summary Assistant enables users to upload document files (PDFs, images), extracts their textual content client-side without sending raw files over the wire, and produces high-quality, structured document summaries through a secure server-side Gemini AI integration.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI & Styling**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **Document Processing**: [PDF.js](https://mozilla.github.io/pdf.js/) (PDF text extraction), [Tesseract.js](https://tesseract.projectnaptha.com/) (Browser OCR)
- **AI / LLM**: [Gemini 2.5 Flash](https://ai.google.dev/) via `@google/genai`
- **Validation**: [Zod](https://zod.dev/)
- **Deployment**: [Vercel](https://vercel.com/)

## Architecture Overview

```text
Browser
  -> Document Upload
  -> PDF.js / Tesseract.js client-side extraction
  -> Extracted text
  -> Next.js API Route (/api/summarize)
  -> Summarization Service
  -> Gemini Provider (gemini-2.5-flash)
  -> Structured summary response
  -> React UI Presentation
```

> **Security Note**: The Gemini API key is managed strictly on the server and is never exposed to the client browser.

## Local Setup

1. **Clone & Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env.local` and add your Gemini API key:
   ```bash
   cp .env.example .env.local
   ```
   Set `GEMINI_API_KEY` in `.env.local`:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000).

4. **Lint and Typecheck**:
   ```bash
   npm run lint
   npx tsc --noEmit
   ```
