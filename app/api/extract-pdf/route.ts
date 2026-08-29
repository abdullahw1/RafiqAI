import { extractText, getDocumentProxy } from 'unpdf';
import { validateSourceFileName } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 1024 * 1024;
const MAX_PAGES = 25;
const MAX_TEXT_CHARS = 40_000;
const EXTRACTION_TIMEOUT_MS = 15_000;

function json(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('pdf_timeout')), EXTRACTION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
    return json({ error: 'Expected a multipart PDF upload.' }, 415);
  }
  const rawContentLength = request.headers.get('content-length');
  if (rawContentLength === null || !/^\d+$/u.test(rawContentLength)) {
    return json({ error: 'A valid positive Content-Length header is required.' }, 411);
  }
  const contentLength = Number(rawContentLength);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    return json({ error: 'A valid positive Content-Length header is required.' }, 411);
  }
  if (contentLength > MAX_MULTIPART_BYTES) {
    return json({ error: 'The multipart upload is too large.' }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'The multipart upload could not be read.' }, 400);
  }

  const parts = [...form.entries()];
  const fileParts = form.getAll('file');
  if (parts.length !== 1 || fileParts.length !== 1 || parts[0]?.[0] !== 'file') {
    return json({ error: 'Submit exactly one PDF File named file and no extra form parts.' }, 400);
  }
  const file = fileParts[0];
  if (!(file instanceof File)) return json({ error: 'A PDF File named file is required.' }, 400);
  const fileName = validateSourceFileName(file.name);
  if (fileName === null || !fileName.toLowerCase().endsWith('.pdf')) {
    return json({ error: 'The uploaded file must have a valid .pdf filename.' }, 415);
  }
  if (file.type !== 'application/pdf') {
    return json({ error: 'The uploaded file must use application/pdf.' }, 415);
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return json({ error: 'PDF files must be non-empty and no larger than 10MB.' }, 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfMagic(bytes)) return json({ error: 'The file does not have a valid PDF signature.' }, 415);

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  try {
    const secureOptions = {
      isEvalSupported: false,
      enableScripting: false,
      maxImageSize: 16_777_216,
    } as NonNullable<Parameters<typeof getDocumentProxy>[1]> & {
      isEvalSupported: false;
      enableScripting: false;
    };
    pdf = await withTimeout(getDocumentProxy(bytes, secureOptions));
    if (pdf.numPages < 1 || pdf.numPages > MAX_PAGES) {
      return json({ error: `PDFs may contain at most ${MAX_PAGES} pages.` }, 413);
    }
    const extracted = await withTimeout(extractText(pdf, { mergePages: true }));
    const text = extracted.text.trim();
    if (text.length === 0) {
      return json({ error: 'No extractable text was found; image-only PDFs are not supported.' }, 422);
    }
    if (text.length > MAX_TEXT_CHARS) {
      return json({ error: `Extracted text exceeds ${MAX_TEXT_CHARS} characters.` }, 413);
    }
    return json({ text, fileName, pages: extracted.totalPages }, 200);
  } catch {
    return json({ error: 'The PDF is malformed, encrypted, unsupported, or took too long to read.' }, 422);
  } finally {
    if (pdf !== null) {
      await pdf.cleanup().catch(() => undefined);
      const destroy = (pdf as { destroy?: () => Promise<void> }).destroy;
      if (typeof destroy === 'function') await destroy.call(pdf).catch(() => undefined);
    }
  }
}
