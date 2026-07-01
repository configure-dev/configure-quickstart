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

Configure gives agents a hosted sign-in flow and a server-side profile runtime. This repo keeps the two main integration paths separate:

- **Web apps** use the core `configure` SDK. The `web/` example uses `personalize()` as a small web-server convenience.
- **Spectrum message agents** keep Spectrum as the messaging runtime and add Configure at the message boundary with `withConfigure`.

Two complete examples show the main integration paths:

| Example | What it shows |
| :-- | :-- |
| [`web/`](./web) | A "Continue with Configure" button that redirects, exchanges a code, and reads the profile. |
| [`message-agent/`](./message-agent) | A Spectrum/iMessage agent that adds Configure identity and profile context with `withConfigure`. |

## Install

For web apps:

```bash
npm install configure
```

For Spectrum message agents, use the Configure Spectrum adapter with Photon's Spectrum SDK. Until `@configure-ai/spectrum-ts` is published to npm, the message-agent example installs the checked-in preview tarball from `message-agent/vendor/`.

## Usage

**Web apps: `personalize()`**

`personalize()` is a web convenience helper. It runs a minimal sign-in server for the hosted Configure flow, exchanges the returned code server-side, and reads the profile.

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

**Spectrum message agents: `withConfigure()`**

`withConfigure()` is the Spectrum adapter. It wraps an existing [Spectrum](https://github.com/photon-hq/spectrum-ts) message handler so Spectrum continues to own messaging, providers, webhooks, and delivery. Configure resolves identity, consent, profile runtime, and memory access before the handler replies.

```ts
import { withConfigure } from "@configure-ai/spectrum-ts";

const configureSpectrum = withConfigure({
  apiKey: process.env.CONFIGURE_API_KEY!,
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,
  agent: process.env.CONFIGURE_AGENT!,
  store: withConfigure.localStore(),
});

for await (const [space, message] of app.messages) {
  await configureSpectrum.handle(space, message, async (ctx) => {
    const { profile } = await ctx.profile.read();
    // Your model loop and reply logic stay yours.
  });
}
```

> Until `@configure-ai/spectrum-ts` is published to npm, `message-agent/` installs the checked-in preview tarball from `message-agent/vendor/`.

Under the hood, both paths rely on the same Configure primitives: open a hosted Configure handoff, keep tokens server-side, then read the profile. Web apps usually build the hosted URL directly. Spectrum message agents let the adapter own link delivery before the model handler runs.

```ts
const configure = new Configure({ apiKey, agent });
const url = configure.auth.signInUrl({ publishableKey, returnTo }); // hosted web/account-link handoff
const { token } = await configure.auth.exchangeSignInCode(code);    // exchange (sk_)
const profile = await configure.profile({ token }).read();         // read
```

Configure resolves the user server-side before profile access. In Spectrum message agents, `withConfigure()` owns the message-auth handoff so the model does not generate Configure sign-in links.

## Quickstart

```bash
git clone https://github.com/configure-dev/configure-quickstart
cd configure-quickstart/web

cp .env.example .env     # add your keys
npm install
npm run dev              # → http://localhost:4000
```

Open the page, click **Continue with Configure**, and you land on a page showing the profile your server just read. Get your keys with `npx configure setup` or from the [dashboard](https://configure.dev).

For the Spectrum example:

```bash
cd ../message-agent
cp .env.example .env     # add Configure + Photon keys
npm install
npm run dev
```

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

In a Spectrum message agent, `withConfigure()` wraps the existing message handler. Spectrum owns messaging, providers, webhooks, and delivery; Configure resolves identity, consent, and profile access before the agent replies.

## Building with an agent?

This repo is agent-readable. Point a coding agent at [`llms.txt`](./llms.txt) for the whole integration in one file, or drop [`SKILL.md`](./SKILL.md) into its skills.

## Links

- [Documentation](https://docs.configure.dev)
- [Message-agent SSO guide](https://docs.configure.dev/guides/message-agent-sso)
- [`configure` on npm](https://www.npmjs.com/package/configure)
