import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  autosaveProjectWorkflow,
  handlePolarEvent,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [handlePolarEvent, autosaveProjectWorkflow],
});
