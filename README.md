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
  <a href="./web"><img src="./assets/continue-with-configure.svg" alt="Continue with Configure" height="46"></a>
</p>

---

**Install one package and your agent is personalized from the first message** — the same user recognized across iMessage, the web, and any channel at once, and monetized automatically. Built for agent developers, starting with Photon.

Configure is a user-owned system of record for agents. It recognizes the same user across agents and gives each agent user-approved context via API or tool call. Users approve and verify without leaving the flow — no new accounts, no re-onboarding, no reauthorizing every app.

Two complete, copy-paste examples — each is the whole integration:

| Example | What it shows |
| :-- | :-- |
| [`web/`](./web) | A "Continue with Configure" button that redirects, exchanges a code, and reads the profile. |
| [`message-agent/`](./message-agent) | An iMessage agent that recognizes returning users by phone with `resolveMessageIdentity`. |

## Install

```bash
npm install configure
```

Requires `configure >= 1.1.7`.

## Usage

The `web/` example wraps the whole flow in one `personalize()` call. You pass your keys and say what to do when a user signs in — nothing in between:

```ts
import express from "express";
import { personalize } from "./personalize";

const app = express();

personalize(app, {
  apiKey: process.env.CONFIGURE_API_KEY!,                  // sk_, server-side
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,  // pk_, browser-safe
  agent: process.env.CONFIGURE_AGENT!,
  baseUrl: "http://localhost:4000",
  onSignedIn: ({ profile, userId }, res) => res.json(profile),
});

app.listen(4000);
```

Under the hood, that is four SDK calls — build the link, exchange the code server-side, read the profile:

```ts
const configure = new Configure({ apiKey, agent });
const url = configure.auth.signInUrl({ publishableKey, returnTo }); // hosted link (pk_)
const { token } = await configure.auth.exchangeSignInCode(code);    // exchange (sk_)
const profile = await configure.profile({ token }).read();         // read
```

The same hosted link works on the web (a redirect), in iMessage (a text), or in a voice agent (read aloud) — and Configure recognizes the same user across all of them at once. One identity, every channel.

## Quickstart

```bash
git clone https://github.com/configure-dev/configure-quickstart
cd configure-quickstart/web

cp .env.example .env     # add your keys
npm install
npm run dev              # → http://localhost:4000
```

Open the page, click **Continue with Configure**, and you land on a page showing the profile your server just read. Get your keys with `npx configure setup` or from the [dashboard](https://configure.dev).

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

In an agent, the redirect collapses into a single message. The agent texts the link, the user signs in once, and `resolveMessageIdentity` matches them by phone on every turn after that — no second sign-in. See [`message-agent/`](./message-agent) for the full loop.

## Building with an agent?

This repo is agent-readable. Point a coding agent at [`llms.txt`](./llms.txt) for the whole integration in one file, or drop [`SKILL.md`](./SKILL.md) into its skills — it will install `configure`, wire up sign-in, and make the first profile read itself.

## Links

- [Documentation](https://docs.configure.dev)
- [Message-agent SSO guide](https://docs.configure.dev/guides/message-agent-sso)
- [`configure` on npm](https://www.npmjs.com/package/configure)
