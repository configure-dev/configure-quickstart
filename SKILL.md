---
name: configure
description: Add "Sign in with Configure" to an app or agent — show a hosted link, get a token, read the user's profile — and prove it with a real profile read.
homepage: https://configure.dev
docs: https://docs.configure.dev
metadata: {"api_base":"https://api.configure.dev"}
---

# Configure

Configure is the identity and personalization layer for AI agents. A user brings one Memory Profile — identity, preferences, connected tools, and memories — into any product that integrates the SDK. No new accounts, no re-onboarding, no reauthorizing connected services.

## If you were sent here

If someone says "read this and add Sign in with Configure," your job is to let a user sign in with Configure, read their profile, and use it in a personalized response. Treat "Sign in with Configure" as the user-facing name for the flow below.

Read the full agent docs index before using advanced APIs: https://docs.configure.dev/llms.txt

## Install and setup

```bash
npm install configure
npx configure setup
```

`setup` opens Configure in the browser so the developer can sign in, choose or create their agent, and write keys to `.env`:

```bash
CONFIGURE_API_KEY=sk_...         # server only
CONFIGURE_PUBLISHABLE_KEY=pk_...  # browser-safe
CONFIGURE_AGENT=your-agent
```

Do not invent keys, do not ask the model for keys, and do not build a raw phone-OTP path — Configure's hosted page owns verification and consent.

## The flow

```ts
import { Configure } from "configure";

const configure = new Configure({ apiKey, agent });

// 1. Build the hosted sign-in link (defaults to https://sign-in.me/{agent}).
const url = configure.auth.signInUrl({ publishableKey, returnTo });

// 2. The user verifies and consents on Configure's page, then returns with a
//    one-time code.

// 3. Exchange it server-side (sk_).
const { token } = await configure.auth.exchangeSignInCode(code);

// 4. Read the profile and personalize.
const profile = await configure.profile({ token }).read();
```

For message agents on Photon / Spectrum, use the `@configure-ai/spectrum-ts` adapter — `withConfigure().handle(space, message, ctx => ...)` recognizes the texter by phone and hands your handler `ctx.profile` (read / remember / tools).

## Definition of done

- `configure` is installed and `.env` has `CONFIGURE_API_KEY`, `CONFIGURE_PUBLISHABLE_KEY`, `CONFIGURE_AGENT`.
- A user can sign in with Configure — a web redirect, or a link sent in a message.
- The one-time code is exchanged server-side and the token is stored server-side.
- You called `configure.profile({ token }).read()` and used the result in a personalized response.

## Rules

- `sk_` keys stay server-side. `pk_` keys are browser-only.
- The model never sees raw tokens, user IDs, or storage paths.
- Never build a raw OTP flow — the hosted page owns verification and consent.

## Working examples

- Web: https://github.com/configure-dev/configure-quickstart/tree/main/web
- Message agent: https://github.com/configure-dev/configure-quickstart/tree/main/message-agent
