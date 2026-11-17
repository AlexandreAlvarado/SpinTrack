"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
export function PlayerRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className="btn-secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Actualizando…" : "Actualizar estado"}</button>;
}
