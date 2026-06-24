import "dotenv/config";
import express, { type Request, type Response } from "express";
import { Configure } from "configure";

const PORT = Number(process.env.PORT ?? 4000);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// The secret key (sk_) stays here, on the server. The browser never sees it.
const configure = new Configure({
  apiKey: requireEnv("CONFIGURE_API_KEY"),
  agent: requireEnv("CONFIGURE_AGENT"),
});

const app = express();
app.use(express.static("public"));

// Step 1 — send the user to Configure's hosted sign-in, then back to /callback.
// signInUrl only needs the publishable key, so this link is safe to expose.
app.get("/login", (_req: Request, res: Response) => {
  const url = configure.auth.signInUrl({
    publishableKey: requireEnv("CONFIGURE_PUBLISHABLE_KEY"),
    returnTo: `${BASE_URL}/callback`,
    displayName: "Configure Quickstart",
  });
  res.redirect(url);
});

// Step 2 — Configure redirects back with a one-time code. Trade it for a token
// and read the profile. Both calls use the secret key and happen server-side.
app.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) {
    res.status(400).send("Missing sign-in code.");
    return;
  }

  try {
    const { token, userId } = await configure.auth.exchangeSignInCode(code);
    const profile = await configure.profile({ token }).read();
    res.type("html").send(successPage(userId, profile));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).send(`Sign-in failed: ${escapeHtml(message)}`);
  }
});

app.listen(PORT, async () => {
  // One-time: allowlist this callback so Configure will redirect back to it.
  await configure.auth.allowSignInReturnTo(`${BASE_URL}/callback`).catch(() => undefined);
  console.log(`▸ Configure quickstart running at ${BASE_URL}`);
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

function successPage(userId: string, profile: unknown): string {
  const json = escapeHtml(JSON.stringify(profile, null, 2));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Connected · Configure</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0b0d12; color:#e9edf3; font-family: ui-sans-serif, -apple-system, "Segoe UI", sans-serif; }
  main { width:min(640px, 92vw); padding:40px; }
  .ok { display:inline-flex; align-items:center; gap:8px; color:#7ee2a8; font-weight:600; margin-bottom:8px; }
  h1 { font-size:22px; margin:0 0 6px; letter-spacing:-0.01em; }
  p { color:#9aa4b2; margin:0 0 22px; }
  pre { background:#11151c; border:1px solid #232a36; border-radius:12px; padding:18px; overflow:auto; font-size:12.5px; line-height:1.5; color:#c6cfdb; }
  code { color:#9aa4b2; }
</style></head><body><main>
  <div class="ok">✓ Connected</div>
  <h1>Configure knows this user now.</h1>
  <p>Profile for <code>${escapeHtml(userId)}</code> — read server-side with your secret key.</p>
  <pre>${json}</pre>
</main></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
