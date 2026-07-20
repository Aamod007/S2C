"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useLazyGetCheckoutQuery } from "@/redux/api/billing";

/**
 * Checkout flow hook (spec §8.1 / §11 use-billing): asks the server for a
 * Polar checkout session and redirects the browser to it. The server
 * resolves the user from the Clerk session — nothing user-identifying is
 * sent from the client.
 */
export function useBilling() {
  const [trigger] = useLazyGetCheckoutQuery();
  // Redirect latency counts as "loading" too, so the button stays disabled
  // until the browser actually navigates away.
  const [isRedirecting, setIsRedirecting] = useState(false);

  const startCheckout = useCallback(async () => {
    setIsRedirecting(true);
    try {
      const { url } = await trigger().unwrap();
      if (!url) throw new Error("Checkout session has no URL");
      window.location.assign(url);
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error("Could not start checkout. Please try again.");
      setIsRedirecting(false);
    }
  }, [trigger]);

  return { startCheckout, isRedirecting };
}
