"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CheckCircle2, Loader2 } from "lucide-react";

/**
 * Post-checkout landing page (Polar successUrl). Payment confirmation
 * arrives asynchronously (Polar webhook → Inngest → Convex), so this page
 * watches the reactive isEntitled query and forwards to the dashboard the
 * moment the subscription lands — the dashboard root gate re-verifies
 * server-side anyway.
 */
export default function BillingSuccessPage() {
  const router = useRouter();
  const entitled = useQuery(api.subscriptions.isEntitled);

  useEffect(() => {
    if (entitled) router.replace("/dashboard");
  }, [entitled, router]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 p-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-primary" />
      <h1 className="text-2xl font-semibold">Payment received</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We&apos;re activating your subscription — this usually takes a few
        seconds. You&apos;ll be redirected automatically.
      </p>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
