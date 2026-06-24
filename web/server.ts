import "dotenv/config";
import express from "express";
import { personalize } from "./personalize.js";

const PORT = Number(process.env.PORT ?? 4000);
const app = express();
app.use(express.static("public"));

// The entire Sign-in-with-Configure flow is one call. You give it your keys and
// say what to do once a user signs in; personalize() handles the link, the code
// exchange, and the profile read. The secret key never leaves the server.
personalize(app, {
  apiKey: requireEnv("CONFIGURE_API_KEY"),                  // sk_ — stays on the server
  publishableKey: requireEnv("CONFIGURE_PUBLISHABLE_KEY"),  // pk_ — safe in the browser
  agent: requireEnv("CONFIGURE_AGENT"),
  baseUrl: process.env.BASE_URL ?? `http://localhost:${PORT}`,
  onSignedIn: ({ profile, userId }, res) => {
    res.type("html").send(successPage(userId, profile));
  },
});

app.listen(PORT, () => console.log(`▸ Configure quickstart running at http://localhost:${PORT}`));

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
