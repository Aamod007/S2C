"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { generateUserSlug } from "@/lib/slugify";
import { Loader2 } from "lucide-react";

export default function DashboardRootPage() {
  const router = useRouter();
  const user = useQuery(api.users.currentUser);

  useEffect(() => {
    if (user) {
      const session = generateUserSlug(user.name, user.email);
      router.replace(`/dashboard/${session}`);
    }
  }, [user, router]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
