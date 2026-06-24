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

  // Start sign-in: redirect to the hosted page. Only the publishable key is used.
  app.get(loginPath, (_req: Request, res: Response) => {
    res.redirect(
      configure.auth.signInUrl({
        publishableKey: options.publishableKey,
        returnTo,
        displayName: options.agent,
      }),
    );
  });

  // Finish sign-in: exchange the one-time code (sk_) and read the profile.
  app.get(callbackPath, async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      res.status(400).send("Missing sign-in code.");
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
