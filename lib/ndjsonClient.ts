import { NdjsonLineBuffer } from './stream';
import type { StreamEvent } from './types';

const KNOWN_TYPES = new Set(['stage', 'result', 'error', 'complete']);

function parseEvent(line: string): StreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const type = (parsed as { type?: unknown }).type;
    // Unknown event types are ignored rather than treated as errors.
    if (typeof type !== 'string' || !KNOWN_TYPES.has(type)) return null;
    return parsed as StreamEvent;
  } catch {
    return null;
  }
}

/**
 * Reads an NDJSON response body, preserving incomplete lines between chunks and
 * flushing the final buffer (Requirements 5.4, 5.5).
 */
export async function readNdjsonStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const lines = new NdjsonLineBuffer();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of lines.push(decoder.decode(value, { stream: true }))) {
        const event = parseEvent(line);
        if (event !== null) onEvent(event);
      }
    }

    for (const line of [...lines.push(decoder.decode()), ...lines.flush()]) {
      const event = parseEvent(line);
      if (event !== null) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}
