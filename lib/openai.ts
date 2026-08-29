import 'server-only';
import OpenAI from 'openai';

/** Requirement 8.1: credentials are read here only, on the server. */
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1/';
const ANTHROPIC_KEY_PREFIX = 'sk-ant-';

export const STAGE_DEADLINE_MS = 11_000;
export const OVERALL_DEADLINE_MS = 28_000;

let client: OpenAI | null = null;

export function hasOpenAiCredentials(): boolean {
  return (process.env.OPENAI_API_KEY?.trim().length ?? 0) > 0;
}

/**
 * The same variable accepts either an OpenAI key or an Anthropic key. Anthropic exposes
 * an OpenAI-compatible chat-completions endpoint, so a `sk-ant-` key is routed there
 * instead of failing with a 401.
 */
function isAnthropicKey(apiKey: string): boolean {
  return apiKey.startsWith(ANTHROPIC_KEY_PREFIX);
}

function readApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('missing_openai_credentials');
  return apiKey;
}

function getClient(): OpenAI {
  const apiKey = readApiKey();
  client ??= new OpenAI(
    isAnthropicKey(apiKey) ? { apiKey, baseURL: ANTHROPIC_BASE_URL } : { apiKey },
  );
  return client;
}

export function modelName(): string {
  const apiKey = readApiKey();
  const anthropic = isAnthropicKey(apiKey);
  const configured = process.env.OPENAI_MODEL?.trim();

  if (!configured) return anthropic ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL;

  // Avoid sending the template's provider-specific default to the wrong API.
  if (anthropic && /^gpt-/iu.test(configured)) return DEFAULT_ANTHROPIC_MODEL;
  if (!anthropic && /^claude-/iu.test(configured)) return DEFAULT_OPENAI_MODEL;

  return configured;
}

/** Rejects with `stage_timeout` when the deadline expires (Requirements 2.4, 3.8). */
export function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export interface JsonCallOptions {
  system: string;
  user: string;
  signal?: AbortSignal;
}

/** One JSON-only chat completion. Returns the raw assistant text. */
export async function callJsonModel(options: JsonCallOptions): Promise<string> {
  // The Anthropic compatibility endpoint does not accept `response_format`; the prompts
  // demand JSON-only output and `parseJsonObject` tolerates code fences either way.
  const jsonMode = isAnthropicKey(readApiKey())
    ? {}
    : { response_format: { type: 'json_object' as const } };

  const completion = await getClient().chat.completions.create(
    {
      model: modelName(),
      temperature: 0,
      ...jsonMode,
      max_completion_tokens: 1_500,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
    },
    options.signal ? { signal: options.signal } : undefined,
  );

  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Logs provider failures without document text, secrets, or phone numbers
 * (design: error handling / Property 10).
 */
export function logStageFailure(stage: string, error: unknown): void {
  const message = error instanceof Error ? error.message : 'unknown_error';
  console.error(`[rafiqai] stage=${stage} failed: ${message.slice(0, 200)}`);
}
