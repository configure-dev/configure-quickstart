import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Configure } from "configure";

// personalize() is the entire Sign-in-with-Configure flow behind one call — no
// web framework required. It runs a tiny HTTP server that serves your static
// page, builds the hosted sign-in link, exchanges the returned code for a token,
// and reads the profile — so your app never touches the choreography. The secret
// key never leaves this server.
//
// This helper lives in the example to keep it transparent. It is a candidate to
// move into the `configure` SDK itself.

const STATE_COOKIE = "configure_state";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

export interface PersonalizeOptions {
  /** Secret key (sk_). Server-side only. */
  apiKey: string;
  /** Publishable key (pk_). Safe for the browser; only builds the link. */
  publishableKey: string;
  /** Your agent handle in Configure. */
  agent: string;
  /** Where this app runs, e.g. http://localhost:4000. */
  baseUrl: string;
  /**
   * Called after a user signs in, with their profile, id, and token. Return an
   * HTML string to render a page, or any JSON-serializable value to send JSON.
   */
  onSignedIn: (user: { profile: unknown; userId: string; token: string }) => unknown | Promise<unknown>;
  /** Folder of static files to serve at the root. Default "public". */
  publicDir?: string;
  /** Route that starts sign-in. Default "/login". */
  loginPath?: string;
  /** Route Configure redirects back to. Default "/callback". */
  callbackPath?: string;
}

export interface PersonalizeServer {
  /** Start listening on a port. Mirrors http.Server.listen. */
  listen: (port: number, onReady?: () => void) => void;
}

export const personalize = (options: PersonalizeOptions): PersonalizeServer => {
  const configure = new Configure({ apiKey: options.apiKey, agent: options.agent });
  const loginPath = options.loginPath ?? "/login";
  const callbackPath = options.callbackPath ?? "/callback";
  const publicRoot = resolve(options.publicDir ?? "public");
  const returnTo = `${options.baseUrl}${callbackPath}`;

  // Allowlist the callback once so Configure will redirect back to it.
  configure.auth.allowSignInReturnTo(returnTo).catch(() => undefined);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", options.baseUrl);

    // Start sign-in. A one-time `state` is minted, kept in an httpOnly cookie,
    // and echoed back on the callback — the CSRF guard for the OAuth flow.
    if (url.pathname === loginPath) {
      const state = randomUUID();
      res.setHeader("Set-Cookie", `${STATE_COOKIE}=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
      res.writeHead(302, {
        Location: configure.auth.signInUrl({
          publishableKey: options.publishableKey,
          returnTo,
          state,
          displayName: options.agent,
        }),
      });
      res.end();
      return;
    }

    // Finish sign-in: verify the state, exchange the one-time code (sk_), read the profile.
    if (url.pathname === callbackPath) {
      const code = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";
      const expectedState = readCookie(req, STATE_COOKIE);
      res.setHeader("Set-Cookie", `${STATE_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);

      if (!code) return send(res, 400, "text/plain; charset=utf-8", "Missing sign-in code.");
      if (!state || state !== expectedState) return send(res, 400, "text/plain; charset=utf-8", "Invalid sign-in state.");

      try {
        const { token, userId } = await configure.auth.exchangeSignInCode(code);
        const profile = await configure.profile({ token }).read();
        const body = await options.onSignedIn({ profile, userId, token });
        if (typeof body === "string") return send(res, 200, "text/html; charset=utf-8", body);
        return send(res, 200, "application/json; charset=utf-8", JSON.stringify(body, null, 2));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        return send(res, 500, "text/plain; charset=utf-8", `Sign-in failed: ${message}`);
      }
    }

    // Everything else: serve the static page(s).
    await serveStatic(res, publicRoot, url.pathname);
  });

  return { listen: (port, onReady) => { server.listen(port, onReady); } };
};

function readCookie(req: IncomingMessage, name: string): string {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function send(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

async function serveStatic(res: ServerResponse, root: string, pathname: string): Promise<void> {
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = resolve(root, requested);

  // Path-traversal guard: never serve anything outside the public root.
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    return send(res, 403, "text/plain; charset=utf-8", "Forbidden");
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    send(res, 404, "text/plain; charset=utf-8", "Not found");
  }
}
