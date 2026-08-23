/**
 * PDF Test Fixture Generator
 * Generates raw, valid and invalid PDF binaries in memory for unit testing
 */

export function createValidPdf(text = 'Hello PDF World Document Extraction!'): Uint8Array {
  // Simple single-page valid PDF
  const streamContent = `BT\n/F1 12 Tf\n72 712 Td\n(${text}) Tj\nET`;
  const streamLength = streamContent.length;

  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000236 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
393
%%EOF\n`;

  return new TextEncoder().encode(pdfString);
}

export function createBlankPdf(): Uint8Array {
  // Valid PDF with an empty content stream (no text)
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 0 >>
stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000207 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
254
%%EOF\n`;

  return new TextEncoder().encode(pdfString);
}

export function createCorruptPdf(): Uint8Array {
  return new TextEncoder().encode('NOT_A_PDF_CORRUPT_DATA_1234567890');
}

export function createMalformedHeaderPdf(): Uint8Array {
  return new TextEncoder().encode('%PDF-broken-invalid-trailer');
}
