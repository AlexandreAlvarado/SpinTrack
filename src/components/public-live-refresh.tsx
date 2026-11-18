"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresca la misma lectura pública, sin canales privados ni suscripciones a actas. */
export function PublicLiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  return null;
}
