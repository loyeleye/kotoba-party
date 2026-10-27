// The one door to the LLM. The host and the judge ask for a small JSON object that matches a Zod schema;
// this file turns that into a Claude call, enforces the per-game cost cap, and fails fast so callers can fall
// back. Nothing here retries: a party game would rather use the written line than wait for a second attempt.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type * as z from 'zod/v4';

export type LlmPurpose = 'host' | 'judge';

export interface LlmRequest<T> {
  purpose: LlmPurpose;
  /** A model for this call only, instead of the purpose's (the Onsen suspects' lead-ins need a fast one). */
  model?: string;
  system: string;
  user: string;
  /** Images shown before the user text (the Ink Storm coach's drawing). */
  images?: { mediaType: 'image/png'; data: string }[];
  schema: z.ZodType<T>;
  /** Give up after this long; the caller falls back. */
  timeoutMs: number;
  budget?: LlmBudget;
  signal?: AbortSignal;
}

export interface LlmClient {
  complete<T>(req: LlmRequest<T>): Promise<T>;
}

export class LlmUnavailable extends Error {
  constructor(
    readonly reason: 'budget' | 'timeout' | 'refusal' | 'unparsed' | 'api' | 'aborted',
    message: string,
  ) {
    super(message);
    this.name = 'LlmUnavailable';
  }
}

// ---------- Cost ----------

/** US dollars per million tokens (Claude API list prices, Oct 2026). Unknown models count at the Opus rate. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const FALLBACK_PRICE = PRICES['claude-opus-5-5']!;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costUsd(model: string, u: TokenUsage): number {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  const cacheWrite = (u.cache_creation_input_tokens ?? 0) * 1.25;
  return ((u.input_tokens + cacheWrite) * p.input + (u.cache_read_input_tokens ?? 0) * p.cacheRead + u.output_tokens * p.output) / 1e6;
}

/**
 * One game's LLM allowance (design doc: under $0.10 per 15-minute game). Once spent, every call fails at once
 * with reason 'budget' and the game runs on pack content and the written line bank for the rest of the night.
 * A call in flight when the cap is crossed still finishes: the cap is checked before each call, not during.
 */
export class LlmBudget {
  spentUsd = 0;
  calls = 0;
  readonly byPurpose: Record<LlmPurpose, { calls: number; usd: number }> = { host: { calls: 0, usd: 0 }, judge: { calls: 0, usd: 0 } };

  constructor(readonly capUsd = 0.1) {}

  get exhausted(): boolean {
    return this.spentUsd >= this.capUsd;
  }

  record(purpose: LlmPurpose, usd: number): void {
    this.spentUsd += usd;
    this.calls++;
    this.byPurpose[purpose].calls++;
    this.byPurpose[purpose].usd += usd;
  }
}

// ---------- Claude ----------

export interface ClaudeLlmOptions {
  client?: Anthropic;
  /** Model per purpose. Defaults to the current Opus; set KOTOBA_HOST_MODEL / KOTOBA_JUDGE_MODEL to change. */
  models?: Partial<Record<LlmPurpose, string>>;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  onCall?: (info: { purpose: LlmPurpose; model: string; ms: number; usd: number; ok: boolean }) => void;
}

const DEFAULT_MODEL = 'claude-opus-5-5';

export class ClaudeLlm implements LlmClient {
  private readonly client: Anthropic;
  private readonly models: Record<LlmPurpose, string>;

  constructor(private readonly opts: ClaudeLlmOptions = {}) {
    // No retries: the timeout is the round's, and a retry would blow it.
    // KOTOBA_ANTHROPIC_API_KEY wins over ANTHROPIC_API_KEY: Claude Code cloud sessions strip the standard name (and
    // point ANTHROPIC_BASE_URL at their own proxy), so the game's own key goes straight to the public API.
    const ownKey = process.env.KOTOBA_ANTHROPIC_API_KEY;
    this.client =
      opts.client ??
      new Anthropic({ maxRetries: 0, ...(ownKey ? { apiKey: ownKey, authToken: null, baseURL: 'https://api.anthropic.com' } : {}) });
    this.models = {
      host: opts.models?.host ?? process.env.KOTOBA_HOST_MODEL ?? DEFAULT_MODEL,
      judge: opts.models?.judge ?? process.env.KOTOBA_JUDGE_MODEL ?? DEFAULT_MODEL,
    };
  }

  async complete<T>(req: LlmRequest<T>): Promise<T> {
    if (req.budget?.exhausted) throw new LlmUnavailable('budget', 'Game LLM budget spent');
    const model = req.model ?? this.models[req.purpose];
    const started = Date.now();
    let usd = 0;
    try {
      const msg = await this.client.beta.messages.parse(
        {
          model,
          max_tokens: this.opts.maxTokens ?? 2000,
          // A stable system prompt first, so repeated calls in a game hit the prompt cache.
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: [
            {
              role: 'user',
              content: req.images?.length
                ? [...req.images.map((img) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.data } })), { type: 'text' as const, text: req.user }]
                : req.user,
            },
          ],
          output_config: { effort: this.opts.effort ?? 'low', format: betaZodOutputFormat(req.schema) },
          // If a safety classifier declines (false positives happen on odd joke answers), the API re-runs the
          // request on a fallback model inside the same call.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { timeout: req.timeoutMs, signal: req.signal, maxRetries: 0 },
      );
      usd = costUsd(msg.model ?? model, msg.usage);
      req.budget?.record(req.purpose, usd);
      if (msg.stop_reason === 'refusal') throw new LlmUnavailable('refusal', 'Model declined');
      if (msg.parsed_output == null) throw new LlmUnavailable('unparsed', `No parsed output (stop: ${msg.stop_reason})`);
      this.opts.onCall?.({ purpose: req.purpose, model, ms: Date.now() - started, usd, ok: true });
      return msg.parsed_output as T;
    } catch (e) {
      this.opts.onCall?.({ purpose: req.purpose, model, ms: Date.now() - started, usd, ok: false });
      if (e instanceof LlmUnavailable) throw e;
      if (e instanceof Anthropic.APIUserAbortError) throw new LlmUnavailable('aborted', 'Aborted');
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new LlmUnavailable('timeout', `No answer in ${req.timeoutMs} ms`);
      if (e instanceof Anthropic.APIError) throw new LlmUnavailable('api', `${e.status ?? ''} ${e.message}`);
      throw new LlmUnavailable('unparsed', String(e));
    }
  }
}

/** A Claude client when a key is configured, otherwise undefined (the game then runs on banks and packs). */
export function llmFromEnv(opts: ClaudeLlmOptions = {}): LlmClient | undefined {
  if (!process.env.KOTOBA_ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !opts.client) return undefined;
  return new ClaudeLlm(opts);
}

// ---------- Test double ----------

/**
 * Answers from a function, after an optional delay, for tests and for running the game without a key.
 * Validates with the request's schema, like the real client.
 */
export class ScriptedLlm implements LlmClient {
  calls: LlmRequest<unknown>[] = [];

  constructor(
    private readonly answer: (req: LlmRequest<unknown>) => unknown | Promise<unknown>,
    private readonly delayMs = 0,
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async complete<T>(req: LlmRequest<T>): Promise<T> {
    if (req.budget?.exhausted) throw new LlmUnavailable('budget', 'Game LLM budget spent');
    this.calls.push(req as LlmRequest<unknown>);
    if (this.delayMs) await this.wait(this.delayMs);
    if (req.signal?.aborted) throw new LlmUnavailable('aborted', 'Aborted');
    const out = await this.answer(req as LlmRequest<unknown>);
    req.budget?.record(req.purpose, 0.001);
    const parsed = req.schema.safeParse(out);
    if (!parsed.success) throw new LlmUnavailable('unparsed', parsed.error.message);
    return parsed.data;
  }
}
