import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { getConvexToken } from "@/lib/preload";
import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckoutButton } from "@/components/buttons/checkout-button";
import { STANDARD_PLAN_CREDITS, STANDARD_PLAN_NAME } from "@/lib/billing";

const FEATURES = [
  `${STANDARD_PLAN_CREDITS} AI generation credits per month`,
  "Sketch-to-design generation",
  "AI style guides from mood boards",
  "Multi-page workflow generation",
  "Chat-based redesign",
];

/**
 * Billing gate page (spec §4/§11): where unentitled users land from the
 * dashboard routing gate. Server-checked — an already-entitled user is
 * bounced straight back to their dashboard.
 */
export default async function BillingPage({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  const { session } = await params;

  const token = await getConvexToken();
  if (token) {
    const entitled = await fetchQuery(api.subscriptions.isEntitled, {}, { token });
    if (entitled) redirect(`/dashboard/${session}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{STANDARD_PLAN_NAME} plan</CardTitle>
          <CardDescription>
            Subscribe to start generating designs from your sketches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <CheckoutButton>Subscribe to {STANDARD_PLAN_NAME}</CheckoutButton>
          <p className="text-center text-xs text-muted-foreground">
            Secure checkout via Polar. Cancel anytime.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
