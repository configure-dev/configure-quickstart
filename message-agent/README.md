# Message agent — Configure on Photon / Spectrum

An iMessage / SMS agent that **recognizes the texter by phone**, offers a `sign-in.me` link to anyone it doesn't know yet, and reasons over their Configure profile — built with the [`@configure-ai/spectrum-ts`](https://www.npmjs.com/package/@configure-ai/spectrum-ts) adapter. The whole agent is in [`agent.ts`](./agent.ts).

## Run it

```bash
cp .env.example .env     # Configure keys + Photon project keys + your model key
npm install
npm run dev
```

You'll need a [Photon](https://app.photon.codes) project (for the iMessage line), Configure keys, and an Anthropic key (this example uses Claude as the brain).

## How it works

The adapter sits at the **message boundary** — it doesn't own your loop or your model. You wrap each turn:

```ts
import { withConfigure, inMemoryStore } from "@configure-ai/spectrum-ts";

const configureSpectrum = withConfigure({ apiKey, publishableKey, agent, store: inMemoryStore() });

for await (const [space, message] of app.messages) {
  await configureSpectrum.handle(space, message, async (ctx) => {
    const { profile } = await ctx.profile.read();   // who's texting + their memory
    // ...your agent + reply...
  });
}
```

For each message, `handle()` gives your handler a `ctx` with:

- **`ctx.profile`** — the Configure profile runtime: `read()`, `search()`, `remember()`, plus `tools()` / `executeTool()` for connected accounts (Gmail, Calendar, …).
- **`ctx.linked`** — `true` once the user has connected their Configure profile.
- **`ctx.signInUrl()` / `ctx.replyWithSignIn()`** — the hosted `sign-in.me/{agent}` link to offer anyone you don't recognize yet.

This example wires that to **Claude**: it reads the profile, **remembers** new facts the user shares, and can use their connected Gmail / Calendar — all over iMessage. Spectrum carries the channel; Configure carries the memory.

> **Production note:** this example uses `inMemoryStore()` for the adapter's local state (the sender → token map), which resets on restart. Swap in a durable store for anything real.
