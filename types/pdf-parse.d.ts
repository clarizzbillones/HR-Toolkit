// pdf-parse ships no types for its internal lib entry; declare a minimal shape.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult { text: string; numpages: number; info: any }
  function pdfParse(data: Buffer | Uint8Array): Promise<PdfParseResult>;
  export default pdfParse;
}
