"use server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validId } from "@/lib/catalogos";

export type DateReview = { token: string; jornada: { id: number; numero: number; fecha: string; estado: string; archivada: boolean }; dependencias: Record<string, number>; protegida: boolean };
export type DateManagementState = { error?: string; success?: string; review?: DateReview };
export async function manageDate(_previous: DateManagementState, form: FormData): Promise<DateManagementState> {
  await requireRole("administrador");
  const operation = form.get("operacion");
  const id = form.get("fecha_id");
  if (typeof id !== "string" || !validId(id) || !["revisar", "eliminar", "archivar", "despublicar"].includes(String(operation))) return { error: "Solicitud inválida." };
  try {
    const db = await createClient();
    if (operation === "revisar") {
      const result = await db.rpc("revisar_jornada_028", { p_fecha: Number(id) });
      if (result.error || !result.data) return { error: "No se pudo revisar la jornada. Comprueba permisos y migración 028." };
      return { review: result.data as DateReview };
    }
    const token = form.get("token"), phrase = form.get("frase");
    if (typeof token !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) || form.get("revisada") !== "on") return { error: "Debes revisar las dependencias en el primer paso." };
    if (operation === "eliminar" && (typeof phrase !== "string" || !/^ELIMINAR JORNADA [1-9]\d*$/.test(phrase))) return { error: "Escribe la confirmación literal indicada." };
    const result = await db.rpc("gestionar_jornada_028", { p_token: token, p_operacion: operation, p_frase: typeof phrase === "string" ? phrase : null });
    if (result.error) return { error: result.error.code === "55000" ? "La jornada tiene dependencias protegidas. Vuelve a revisar y utiliza Archivar." : "No se realizó la operación. La revisión pudo vencer o la jornada pudo cambiar. Vuelve a revisar antes de continuar." };
    revalidatePath("/panel/administrador"); revalidatePath("/calendario"); revalidatePath("/");
    return { success: "Operación registrada. El historial deportivo protegido se conserva." };
  } catch { return { error: "No se pudo confirmar la operación. Consulta el listado antes de reintentar." }; }
}
