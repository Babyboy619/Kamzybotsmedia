import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      if (provider !== "google") {
        return { error: new Error(`OAuth provider '${provider}' is not supported`) };
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: opts?.redirect_uri ?? `${window.location.origin}/dashboard`,
          queryParams: opts?.extraParams,
        },
      });
      if (error) return { error };
      return { redirected: true };
    },
  },
};
