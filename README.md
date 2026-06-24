<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/configure-brandmark-white.svg">
    <img alt="Configure" src="./assets/configure-brandmark-grey.svg" height="56">
  </picture>
</p>

<h1 align="center">Configure Quickstart</h1>

<p align="center">
  <b>Personalization infrastructure for agents.</b><br/>
  Add <b>“Sign in with Configure”</b> to any app or agent — and know who the user is from the very first message.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/configure"><img alt="npm" src="https://img.shields.io/npm/v/configure?color=5b54e6&label=configure"></a>
  <a href="https://docs.configure.dev"><img alt="Docs" src="https://img.shields.io/badge/docs-configure.dev-5b54e6"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-555"></a>
</p>

<p align="center">
  <a href="./web"><img src="./assets/continue-with-configure.svg" alt="Continue with Configure" height="46"></a>
</p>

---

## What this is

Two tiny, complete examples. Each is the **entire** Configure integration — pick one, copy it, ship it.

| Example | What it shows | |
| :-- | :-- | :-- |
| **[`web/`](./web)** | A “Continue with Configure” button → the user’s profile, in ~40 lines | **flagship** |
| **[`message-agent/`](./message-agent)** | An iMessage / SMS agent that recognizes the user silently by phone | Photon / Spectrum |

## The whole idea: it’s just a link

Configure does the hard, scary parts — phone verification, consent, connected accounts — on **its own hosted page**. You send a link, you get back a token, you read the profile. You never touch an OTP or an OAuth token.

```ts
import { Configure } from "configure";

const configure = new Configure({ apiKey, agent });

// 1. Build the hosted sign-in link (publishable key — safe in the browser).
const url = configure.auth.signInUrl({ publishableKey, returnTo });

// 2. The user signs in on Configure’s page and comes back with a one-time code.

// 3. Trade the code for a token — server-side, with your secret key.
const { token } = await configure.auth.exchangeSignInCode(code);

// 4. Read their profile.
const profile = await configure.profile({ token }).read();
```

The same link works on the **web** (a redirect), in **iMessage** (a text), or in a **voice agent** (read it aloud). One primitive, every channel.

## Quickstart

```bash
git clone https://github.com/configure-dev/configure-quickstart
cd configure-quickstart/web

cp .env.example .env     # add your keys from the Configure dashboard
npm install
npm run dev              # → http://localhost:4000
```

Get your keys with `npx configure setup`, or from [the dashboard](https://configure.dev).

## Two keys — and the one rule that matters

| Key | Lives | Does |
| :-- | :-- | :-- |
| `CONFIGURE_API_KEY` (`sk_`) | **server only** | exchange the code, read profiles — full power |
| `CONFIGURE_PUBLISHABLE_KEY` (`pk_`) | browser-safe | build the sign-in link |

> Your **secret key never leaves your server.** Every sensitive call happens on the backend; the user only ever sees Configure’s hosted page. This is the entire security model.

## How it works

```
  Browser                         Your server (sk_)              Configure (hosted)
  ───────                         ─────────────────              ──────────────────
  [Continue with Configure] ─────────▶ /login ──── signInUrl() ─────▶ sign-in.me
                                                                      phone + consent
  show profile  ◀──── profile.read() ◀── exchangeSignInCode(code) ◀── redirect ?code=
```

The browser only ever holds the publishable key and a one-time code. The token and every profile read stay on your server.

## Learn more

- **Docs** — https://docs.configure.dev
- **Message-agent SSO guide** — https://docs.configure.dev/guides/message-agent-sso
- **npm** — https://www.npmjs.com/package/configure

<p align="center"><sub>Built with <a href="https://configure.dev">Configure</a> — the identity layer for the agentic internet.</sub></p>
