"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBilling } from "@/hooks/use-billing";

/** Starts the Polar checkout flow (spec §8.1). */
export function CheckoutButton({
  children = "Subscribe",
  size = "lg",
}: {
  children?: React.ReactNode;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { startCheckout, isRedirecting } = useBilling();

  return (
    <Button size={size} onClick={startCheckout} disabled={isRedirecting}>
      {isRedirecting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}
      {children}
    </Button>
  );
}
