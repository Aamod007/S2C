"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { ReactNode, useEffect } from "react";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

function AuthSync({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const storeUser = useMutation(api.users.storeUser);

  useEffect(() => {
    // If the user is authenticated via Clerk, tell Convex to store/sync the user
    if (isAuthenticated && !isLoading) {
      storeUser().catch(console.error);
    }
  }, [isAuthenticated, isLoading, storeUser]);

  return <>{children}</>;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <AuthSync>{children}</AuthSync>
    </ConvexProviderWithClerk>
  );
}
