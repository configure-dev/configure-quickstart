<p align="center">
  <a href="https://configure.dev" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/configure-brandmark-white.svg">
      <img alt="Configure" src="./assets/configure-brandmark-grey.svg" height="56">
    </picture>
  </a>
</p>

<p align="center">
  Personalization for agents.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/configure"><img alt="npm" src="https://img.shields.io/npm/v/configure?color=5b54e6&label=configure"></a>
  <a href="https://docs.configure.dev"><img alt="Docs" src="https://img.shields.io/badge/docs-configure.dev-5b54e6"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-555"></a>
</p>

<p align="center">
  <a href="https://demo.configure.dev/?mode=story" target="_blank" rel="noopener noreferrer"><img src="./assets/continue-with-configure.svg" alt="Continue with Configure" height="46"></a>
</p>

---

One package, one call. Your agent recognizes the user from the first message — across every channel, monetized automatically.

Two complete, copy-paste examples — each is the whole integration:

| Example | What it shows |
| :-- | :-- |
| [`web/`](./web) | A "Continue with Configure" button that redirects, exchanges a code, and reads the profile. |
| [`message-agent/`](./message-agent) | An iMessage agent (Photon / Spectrum) that recognizes the texter by phone and loads their profile with the `@configure-ai/spectrum-ts` adapter. |

## Install

```bash
npm install configure    # web sign-in
```

Message agents (Photon / Spectrum) use **`@configure-ai/spectrum-ts`** — a private preview **vendored in [`message-agent/`](./message-agent)** until it's on npm. Web needs `configure >= 1.1.9`; the adapter peer-depends on `spectrum-ts >= 8`.

## Usage

**Web** — one `personalize()` call runs the whole sign-in server (no framework, no routes):

```ts
import { personalize } from "configure";

personalize({
  apiKey: process.env.CONFIGURE_API_KEY!,                  // sk_, server-side
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,  // pk_, browser-safe
  agent: process.env.CONFIGURE_AGENT!,
  baseUrl: "http://localhost:4000",
  onSignedIn: ({ profile }) => profile,   // return HTML or JSON
}).listen(4000);
```

**Message agent** — for agents built on [Photon / Spectrum](https://github.com/photon-hq/spectrum-ts), the `@configure-ai/spectrum-ts` adapter wraps your existing message loop: it recognizes the texter by phone, offers the sign-in link, and hands your handler their Configure profile. You keep your loop and your model.

```ts
import { withConfigure, inMemoryStore } from "@configure-ai/spectrum-ts";

const configureSpectrum = withConfigure({
  apiKey: process.env.CONFIGURE_API_KEY!,                  // sk_, server-side
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,  // pk_, browser-safe
  agent: process.env.CONFIGURE_AGENT!,
  store: inMemoryStore(),                                  // swap for a durable store in production
});

for await (const [space, message] of app.messages) {
  await configureSpectrum.handle(space, message, async (ctx) => {
    const { profile } = await ctx.profile.read();   // who's texting + their memory
    await message.reply(await runAgent({ message, profile, linked: ctx.linked }));
  });
}
```

> Web sign-in uses `personalize` from `configure` (zero extra deps). Message agents use the separate `@configure-ai/spectrum-ts` adapter, which peer-depends on `spectrum-ts` — so web-only users never install it.

Under the hood, that is four SDK calls — build the link, exchange the code server-side, read the profile:

```ts
const configure = new Configure({ apiKey, agent });
const url = configure.auth.signInUrl({ publishableKey, returnTo }); // sign-in.me hosted link (pk_)
const { token } = await configure.auth.exchangeSignInCode(code);    // exchange (sk_)
const profile = await configure.profile({ token }).read();         // read
```

The same `sign-in.me` hosted link works on the web (a redirect), in iMessage (a text), or in a voice agent (read aloud) — and Configure recognizes the same user across all of them at once. One identity, everywhere.

## Quickstart

```bash
git clone https://github.com/configure-dev/configure-quickstart
cd configure-quickstart/web

cp .env.example .env     # add your keys
npm install
npm run dev              # → http://localhost:4000
```

Open the page, click **Continue with Configure**, and you land on a page showing the profile your server just read. Get your keys with `npx configure setup` or from the [dashboard](https://configure.dev/dashboard).

## Keys

Configure uses two keys with different reach. Getting this split right is the entire security model.

| Variable | Prefix | Where it lives |
| :-- | :-- | :-- |
| `CONFIGURE_API_KEY` | `sk_` | Server only. Exchanges the code and reads profiles. |
| `CONFIGURE_PUBLISHABLE_KEY` | `pk_` | Browser-safe. Builds the sign-in link. |
| `CONFIGURE_AGENT` | — | Your agent handle in Configure. |

The secret key never leaves your server. The browser only ever holds the publishable key and a one-time code; the token and every profile read stay on the backend.

## How it works

```
  Browser                         Your server (sk_)              Configure (hosted)
  ───────                         ─────────────────              ──────────────────
  Continue with Configure ───────────▶ /login ──── signInUrl() ──────▶ phone + consent
                                                                       │
  show profile  ◀──── profile.read() ◀── exchangeSignInCode(code) ◀────┘ redirect ?code=
```

In an agent, the redirect collapses into a single message. The agent texts the `sign-in.me` link, the user signs in once, and the adapter recognizes them by phone on every turn after that — no second OTP loop in the thread.

## Building with an agent?

This repo is agent-readable. Point a coding agent at [`llms.txt`](./llms.txt) for the whole integration in one file, or drop [`SKILL.md`](./SKILL.md) into its skills — it will install `configure`, build the hosted link, exchange the code, and make the first profile read.

## Links

- [Documentation](https://docs.configure.dev)
- [Message-agent SSO guide](https://docs.configure.dev/guides/message-agent-sso)
- [`configure` on npm](https://www.npmjs.com/package/configure)
