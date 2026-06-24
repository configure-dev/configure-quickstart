import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { Configure } from "configure";

// personalize() is the entire Sign-in-with-Configure flow behind one call.
// It mounts the login + callback routes, builds the hosted sign-in link,
// exchanges the returned code for a token, and reads the profile — so the app
// never has to touch the choreography. You provide keys and an onSignedIn
// handler; the secret key stays here on the server.
//
// This helper lives in the example to keep it transparent. It is a candidate to
// move into the `configure` SDK itself as a framework adapter.

const STATE_COOKIE = "configure_state";

export interface PersonalizeOptions {
  /** Secret key (sk_). Server-side only. */
  apiKey: string;
  /** Publishable key (pk_). Safe for the browser; only builds the link. */
  publishableKey: string;
  /** Your agent handle in Configure. */
  agent: string;
  /** Where this app runs, e.g. http://localhost:4000. */
  baseUrl: string;
  /** Called after a user signs in, with their profile, id, and token. */
  onSignedIn: (
    user: { profile: unknown; userId: string; token: string },
    res: Response,
  ) => void | Promise<void>;
  /** Route that starts sign-in. Default "/login". */
  loginPath?: string;
  /** Route Configure redirects back to. Default "/callback". */
  callbackPath?: string;
}

export const personalize = (app: Express, options: PersonalizeOptions): Configure => {
  const configure = new Configure({ apiKey: options.apiKey, agent: options.agent });
  const loginPath = options.loginPath ?? "/login";
  const callbackPath = options.callbackPath ?? "/callback";
  const returnTo = `${options.baseUrl}${callbackPath}`;

  // Start sign-in. A one-time `state` is minted, kept in an httpOnly cookie, and
  // echoed back on the callback — this is the CSRF guard for the OAuth flow.
  app.get(loginPath, (_req: Request, res: Response) => {
    const state = randomUUID();
    res.setHeader("Set-Cookie", `${STATE_COOKIE}=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
    res.redirect(
      configure.auth.signInUrl({
        publishableKey: options.publishableKey,
        returnTo,
        state,
        displayName: options.agent,
      }),
    );
  });

  // Finish sign-in: verify the state, exchange the one-time code (sk_), read the profile.
  app.get(callbackPath, async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expectedState = readCookie(req, STATE_COOKIE);
    res.setHeader("Set-Cookie", `${STATE_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);

    if (!code) {
      res.status(400).send("Missing sign-in code.");
      return;
    }
    if (!state || state !== expectedState) {
      res.status(400).send("Invalid sign-in state.");
      return;
    }

    try {
      const { token, userId } = await configure.auth.exchangeSignInCode(code);
      const profile = await configure.profile({ token }).read();
      await options.onSignedIn({ profile, userId, token }, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).send(`Sign-in failed: ${message}`);
    }
  });

  // Allowlist the callback once so Configure will redirect back to it.
  configure.auth.allowSignInReturnTo(returnTo).catch(() => undefined);

  return configure;
};

function readCookie(req: Request, name: string): string {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}
