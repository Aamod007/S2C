import { Inngest } from "inngest";

// Shared Inngest client. Event key / signing key are picked up from
// INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY env vars automatically; in local
// dev (`npx inngest-cli dev`) neither is required.
export const inngest = new Inngest({ id: "s2c-app" });
