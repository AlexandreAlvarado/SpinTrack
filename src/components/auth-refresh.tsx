"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/config";

// Los eventos solicitan una lectura del servidor; nunca proporcionan roles.
export function AuthRefresh() {
  const router = useRouter();
  useEffect(() => {
    if (!supabaseConfigured()) return;
    const { data } = createClient().auth.onAuthStateChange(event => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") router.refresh();
    });
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => { data.subscription.unsubscribe(); window.removeEventListener("focus", refresh); };
  }, [router]);
  return null;
}
