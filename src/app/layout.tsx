import {ClerkProvider} from "@clerk/nextjs";
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { api } from "@convex/_generated/api";
import { ConvexClientProvider } from "@/components/convex-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/redux/provider";
import { preloadAuthedQuery } from "@/lib/preload";
import type { NormalizedProfile } from "@/types/user";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "S2C — Sketch to Code",
  description:
    "AI-powered SaaS for designers. Sketch wireframes, build mood boards, and generate full HTML/Tailwind UI designs with AI.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Profile preload (spec §5): fetch the signed-in user's profile server-side
  // and hydrate it into the Redux store so the navbar renders user info
  // without a loading flicker. Fail-soft null when signed out.
  const convexUser = await preloadAuthedQuery(api.users.currentUser, {});
  const profile: NormalizedProfile | null = convexUser
    ? {
        id: convexUser._id,
        name: convexUser.name,
        email: convexUser.email,
        image: convexUser.image,
      }
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ConvexClientProvider>
          <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          >
          <StoreProvider preloadedState={{ profile: { user: profile } }}>
          <TooltipProvider>
          {children}
          </TooltipProvider>
          </StoreProvider>
          <Toaster richColors position="bottom-right" />
          </ThemeProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}