import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { HostLineSchema } from '../hostVoice.js';
import { ClaudeLlm, LlmBudget, LlmUnavailable, costUsd } from '../llm.js';

/** A fake Messages API: records the request body and answers with one JSON text block. */
function fakeClaude(reply: unknown, stop = 'end_turn') {
  const bodies: Record<string, unknown>[] = [];
  const client = new Anthropic({
    apiKey: 'test-key',
    maxRetries: 0,
    fetch: (async (_url: string | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(reply) }],
        stop_reason: stop,
        stop_sequence: null,
        usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      });
    }) as typeof fetch,
  });
  return { client, bodies };
}

const line = { text: 'いっぽん！', kana: 'いっぽん！', en: 'IPPON!' };

describe('Claude client', () => {
  it('asks for structured output at low effort, with fallbacks, and records the cost', async () => {
    const { client, bodies } = fakeClaude(line);
    const budget = new LlmBudget(0.1);
    const out = await new ClaudeLlm({ client }).complete({ purpose: 'host', system: 's', user: 'u', schema: HostLineSchema, timeoutMs: 1000, budget });
    expect(out).toEqual(line);
    const body = bodies[0]!;
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.fallbacks).toBe('default');
    expect(body.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } });
    expect(budget.spentUsd).toBeCloseTo(costUsd('claude-opus-5-5', { input_tokens: 1000, output_tokens: 100 }));
    expect(budget.byPurpose.host.calls).toBe(1);
  });

  it('turns a refusal or a spent budget into LlmUnavailable', async () => {
    const { client } = fakeClaude(line, 'refusal');
    await expect(new ClaudeLlm({ client }).complete({ purpose: 'host', system: 's', user: 'u', schema: HostLineSchema, timeoutMs: 1000 })).rejects.toMatchObject({ reason: 'refusal' });
    const spent = new LlmBudget(0);
    await expect(new ClaudeLlm({ client }).complete({ purpose: 'host', system: 's', user: 'u', schema: HostLineSchema, timeoutMs: 1000, budget: spent })).rejects.toBeInstanceOf(LlmUnavailable);
  });

  it('prices models', () => {
    expect(costUsd('claude-haiku-5-5', { input_tokens: 1e6, output_tokens: 0 })).toBeCloseTo(0.1);
    expect(costUsd('claude-opus-5-5', { input_tokens: 0, output_tokens: 1e6 })).toBeCloseTo(20);
  });
});
