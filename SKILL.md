---
name: configure
description: Add "Sign in with Configure" to an app or agent — show a hosted link, get a token, expose Configure tools, and prove it with a personalized response plus a real profile read/search path.
homepage: https://configure.dev
docs: https://docs.configure.dev
metadata: {"api_base":"https://api.configure.dev"}
---

# Configure

Configure is the identity and personalization layer for AI agents. A user brings one Memory Profile — identity, preferences, connected tools, and memories — into any product that integrates the SDK. No new accounts, no re-onboarding, no reauthorizing connected services.

## If you were sent here

If someone says "read this and add Sign in with Configure," your job is to let a user sign in with Configure, expose Configure tools in the model loop, and use tool results in a personalized response. Treat "Sign in with Configure" as the user-facing name for the flow below.

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

// 4. Create the profile runtime, expose Configure tools, and route
//    configure_* calls through profile.executeTool().
const profile = configure.profile({ token });
const tools = profile.tools({
  connectors: ["gmail", "calendar"],
  actions: ["email.send", "calendar.create_event"],
});
```

For message agents on Photon Spectrum, use `configure-spectrum` and `withConfigure` with `signIn.linkMode: "managed"`. Spectrum owns messaging and delivery; Configure resolves identity, consent, profile runtime, and memory before the handler replies.

For Spectrum iMessage, let the adapter infer message return metadata from the current turn's routed `space.phone`. Only pass `signIn.agentPhone` for an explicit, deterministic app-owned line binding.

Use Configure tools as the normal model-loop path; use `configure_profile_read` and `configure_profile_search` for overview, concrete memories, imported-source questions such as "what does ChatGPT remember about me?", and details that need exact source attribution. `profile.read({ sections })` plus `profile.format()` is available for app-owned UI, inspection, or explicit context slots. After a read-backed turn, call `profile.commit()` or `ctx.profile.commit()` with bounded user/assistant turn evidence.

Tool visibility means hosted/app capability, not user authorization. Expose connector and action tools when the hosted/product surface requested those capabilities and the app supports them. `profile.executeTool()` still enforces linked state, connector state, permissions, scopes, approval, and reconnect recovery; if a connector/action is unavailable, send the hosted connect, reconnect, permissions, or approval link.

For tight prompt budgets, choose narrower `sections` and keep `configure_profile_search` available for source-specific follow-up retrieval. Do not teach broad reads plus local prompt chopping as the default personalization path.

## Definition of done

- `configure` is installed and `.env` has `CONFIGURE_API_KEY`, `CONFIGURE_PUBLISHABLE_KEY`, `CONFIGURE_AGENT`.
- A user can sign in with Configure — a web redirect, or a link sent in a message.
- The one-time code is exchanged server-side and the token is stored server-side.
- You exposed Configure tools, routed `configure_*` calls through `profile.executeTool()`, and used returned profile/tool context in a personalized response.

## Rules

- `sk_` keys stay server-side. `pk_` keys are browser-only.
- The model never sees raw tokens, user IDs, or storage paths.
- Never build a raw OTP flow — the hosted page owns verification and consent.

## Working examples

- Web: https://github.com/configure-dev/configure-quickstart/tree/main/web
- Message agent: https://github.com/configure-dev/configure-quickstart/tree/main/message-agent
