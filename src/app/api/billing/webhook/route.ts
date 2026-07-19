import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { inngest } from "@/inngest/client";

// POST /api/billing/webhook — verify the Polar signature over the RAW body,
// hand the event off to Inngest, and ack immediately (spec §8.2). All real
// processing happens in the handlePolarEvent Inngest function.
export async function POST(request: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Billing webhook: POLAR_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 500 }
    );
  }

  // Polar signs the raw payload — read it as text, never JSON.parse first.
  const rawBody = await request.text();

  let event;
  try {
    event = validateEvent(
      rawBody,
      Object.fromEntries(request.headers.entries()),
      secret
    );
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    console.error("Billing webhook: validation failed unexpectedly", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 403 });
  }

  try {
    await inngest.send({
      name: "billing/polar.webhook.received",
      data: { event },
    });
  } catch (error) {
    // Non-2xx makes Polar retry the delivery — exactly what we want if the
    // event queue is unreachable.
    console.error("Billing webhook: failed to enqueue event", error);
    return NextResponse.json(
      { error: "Failed to enqueue event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 202 });
}
