import { Recording } from '../domain/recording.ts';

/** The part of `fetch`'s Response this module reads — lets tests run without a server. */
export interface ResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The server's `{ error: string }` message, if the body is exactly that shape. */
function errorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  return typeof body.error === 'string' ? body.error : null;
}

/**
 * Reads the `/api/extract` response: a schema-validated recording, or an Error carrying the
 * server's message (falling back to the HTTP status for bodies that are not JSON).
 */
export async function readExtractResponse(res: ResponseLike): Promise<Recording> {
  const body = parseJson(await res.text());
  if (!res.ok) throw new Error(errorMessage(body) ?? `HTTP ${res.status}`);
  const parsed = Recording.safeParse(body);
  if (!parsed.success)
    throw new Error('The server answered with something that is not a valid recording.');
  return parsed.data;
}
