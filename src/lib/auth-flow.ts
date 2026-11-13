export function authOrigin() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("URL de sitio inválida");
  return url.origin;
}
export function authError(error: { code?: string; status?: number } | null) {
  if (error?.status === 429 || error?.code?.includes("rate_limit")) return "limite";
  if (error?.code === "email_not_confirmed") return "pendiente";
  if (error?.code === "weak_password") return "politica";
  return "credenciales";
}
export function passwordValue(data: FormData, key = "password") {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}
export function validPassword(password: string) { return password.length >= 8 && password.length <= 1024; }
export const AUTH_MESSAGES: Record<string, string> = {
  configuracion: "El servicio no está disponible. Contacta a la administración.",
  credenciales: "No fue posible ingresar. Revisa tu correo y contraseña.",
  pendiente: "Confirma tu correo antes de iniciar sesión. Revisa también la carpeta de spam.",
  limite: "Demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.",
  politica: "La contraseña no cumple la política del servicio. Usa una más larga, con mayúsculas, minúsculas, números y símbolos.",
  datos: "Revisa los datos. La contraseña debe tener entre 8 y 1024 caracteres y coincidir con su confirmación.",
  envio: "No se pudo completar la solicitud. Espera unos minutos y vuelve a intentarlo.",
  enlace: "El enlace no es válido, ya se utilizó o caducó. Solicita uno nuevo.",
  actualizacion: "No se pudo actualizar la contraseña. Vuelve a intentarlo o solicita otro enlace.",
  confirmacion: "No se pudo confirmar el correo. Revisa el enlace recibido.",
  sesion: "Necesitas iniciar sesión y disponer de un perfil activo para continuar.",
  cierre: "No se pudo cerrar la sesión. Inténtalo desde el menú de usuario.",
};
