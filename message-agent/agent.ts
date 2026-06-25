import "dotenv/config";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { personalize } from "./personalize.js";

// Spectrum is the transport — it makes your agent reachable over iMessage.
const app = await Spectrum({
  projectId: process.env.PHOTON_PROJECT_ID!,
  projectSecret: process.env.PHOTON_PROJECT_SECRET!,
  providers: [imessage.config()],
});

// personalize() is the Configure layer. It recognizes every texter by phone,
// texts a sign-in link when they ask to "connect", and reads their profile —
// you just write the reply.
personalize(app, {
  apiKey: process.env.CONFIGURE_API_KEY!,
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,
  agent: process.env.CONFIGURE_AGENT!,
  agentPhone: process.env.AGENT_PHONE_NUMBER,
  reply: ({ name, linked }) =>
    linked
      ? `hey ${name ?? "there"}, what's up?`
      : `hey! text "connect" and I'll remember you next time.`,
});
