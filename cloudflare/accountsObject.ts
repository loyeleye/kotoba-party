// Every account on one Durable Object (docs/accounts.md). Sign-ins and saved games are rare next to
// room traffic, so one object is plenty, and it makes each change to an account happen one at a time.
// The Worker sends it `/api/account/*`; rooms send it finished games at `/results`.

import { DurableObject } from 'cloudflare:workers';
import { Accounts, type AccountStorage } from '../server/src/accounts.js';
import type { AccountResult } from '../server/src/room.js';
import type { Env } from './env.js';

/** The one object's name. */
export const ACCOUNTS_NAME = 'accounts';

export class AccountsObject extends DurableObject<Env> {
  private readonly accounts: Accounts;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const storage: AccountStorage = {
      get: (key) => ctx.storage.get(key),
      put: (key, value) => ctx.storage.put(key, value),
      delete: async (key) => void (await ctx.storage.delete(key)),
    };
    this.accounts = new Accounts(storage);
  }

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    // The passkey checks await crypto, which lets other requests in; this keeps each one whole.
    return this.ctx.blockConcurrencyWhile(async () => {
      if (url.pathname === '/results' && req.method === 'POST') {
        await this.accounts.recordResults((await req.json()) as AccountResult[]);
        return new Response(null, { status: 204 });
      }
      const action = url.pathname.replace(/^\/api\//, '');
      return this.accounts.handle(req, action, url.searchParams.get('origin') ?? '');
    });
  }
}
