// Cambiar junto con version_legal_028 mediante una revisión legal explícita.
export const LEGAL_VERSION = "2026-11-19.1";
// Version aprobada institucionalmente; conserva la identidad registrada en 028.
// La aprobación del documento y las autorizaciones de datos son independientes.
export const LEGAL_REVIEW_PENDING = false;
export const PERSONAL_DATA_REVIEW_PENDING = true;
export function acceptsLegal(form: FormData) {
  return form.get("acepta_terminos") === "on" && form.get("terminos_version") === LEGAL_VERSION;
}
