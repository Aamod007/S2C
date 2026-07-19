import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutDashboard, LogIn, UserPlus } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      {/* Background gradient blob */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary/20 opacity-50 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center space-y-8 max-w-3xl">
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
            Sketch to Code <span className="text-primary">(S2C)</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-zinc-400 sm:text-xl">
            Design beautiful wireframes on an infinite canvas and let AI generate 
            production-ready Next.js & Tailwind code instantly.
          </p>
        </div>

        <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
          <Button asChild size="lg" className="w-full font-semibold group">
            <Link href="/sign-up">
              <UserPlus className="mr-2 h-4 w-4" />
              Sign Up Free
              <ArrowRight className="ml-2 h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/sign-in">
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Link>
          </Button>

          <Button asChild variant="secondary" size="lg" className="w-full sm:col-span-2 mt-4 border border-white/10 bg-white/5 hover:bg-white/10">
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
              Enter Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
