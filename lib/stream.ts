import type { AnalysisMode, StageId, StageStatus, StreamEvent } from './types';

const encoder = new TextEncoder();

export function encodeEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

/**
 * Small wrapper that guarantees at most one `complete` event per stream
 * (Property 9) and swallows writes after close so a disconnected client cannot
 * turn into an unhandled rejection.
 */
export class NdjsonWriter {
  private closed = false;
  private completed = false;

  constructor(private readonly controller: ReadableStreamDefaultController<Uint8Array>) {}

  send(event: StreamEvent): void {
    if (this.closed) return;
    if (event.type === 'complete') {
      if (this.completed) return;
      this.completed = true;
    }
    try {
      this.controller.enqueue(encodeEvent(event));
    } catch {
      // Client disconnected mid-write; stop emitting.
      this.closed = true;
    }
  }

  stage(id: StageId, status: StageStatus, note?: string): void {
    this.send(note === undefined ? { type: 'stage', id, status } : { type: 'stage', id, status, note });
  }

  complete(mode: AnalysisMode): void {
    this.send({ type: 'complete', mode });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.controller.close();
    } catch {
      // Already closed.
    }
  }
}

/**
 * Incremental NDJSON parser used by the browser reader. It carries incomplete lines
 * across chunks and only surfaces complete records (Requirement 5.4).
 */
export class NdjsonLineBuffer {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const parts = this.buffer.split('\n');
    this.buffer = parts.pop() ?? '';
    return parts.map((line) => line.trim()).filter((line) => line.length > 0);
  }

  /** Returns any trailing complete-but-unterminated record at end of stream. */
  flush(): string[] {
    const remainder = this.buffer.trim();
    this.buffer = '';
    return remainder.length > 0 ? [remainder] : [];
  }
}
