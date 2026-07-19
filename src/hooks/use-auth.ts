"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ── Zod Schemas ──────────────────────────────────────────────

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
});

export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;

// ── Hook ─────────────────────────────────────────────────────

export function useAuth() {
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", name: "" },
  });

  const signIn = useCallback(
    async (data: SignInFormData) => {
      setAuthError(null);
      setIsSubmitting(true);
      try {
        await convexSignIn("password", {
          email: data.email,
          password: data.password,
          flow: "signIn",
        });
      } catch (error) {
        setAuthError(
          error instanceof Error
            ? error.message
            : "Failed to sign in. Please check your credentials."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [convexSignIn]
  );

  const signUp = useCallback(
    async (data: SignUpFormData) => {
      setAuthError(null);
      setIsSubmitting(true);
      try {
        await convexSignIn("password", {
          email: data.email,
          password: data.password,
          name: data.name,
          flow: "signUp",
        });
      } catch (error) {
        setAuthError(
          error instanceof Error
            ? error.message
            : "Failed to create account. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [convexSignIn]
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await convexSignIn("google");
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Failed to sign in with Google."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [convexSignIn]);

  const signOut = useCallback(async () => {
    try {
      await convexSignOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }, [convexSignOut]);

  return {
    // State
    isAuthenticated,
    isLoading,
    isSubmitting,
    authError,

    // Actions
    signIn,
    signUp,
    signInWithGoogle,
    signOut,

    // Forms
    signInForm,
    signUpForm,
  };
}
