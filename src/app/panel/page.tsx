import { redirect } from "next/navigation";
import { ROLE_PATHS } from "@/lib/roles";
import { requireProfile } from "@/lib/auth";

export default async function PanelHome() {
  const profile = await requireProfile();
  redirect(ROLE_PATHS[profile.rol]);
}
