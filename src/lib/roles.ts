export const ROLES = ["administrador", "juez_general", "arbitro", "jugador"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  administrador: "Administrador",
  juez_general: "Juez General",
  arbitro: "Árbitro",
  jugador: "Jugador",
};

export const ROLE_PATHS: Record<Role, string> = {
  administrador: "/panel/administrador",
  juez_general: "/panel/juez-general",
  arbitro: "/panel/arbitro",
  jugador: "/panel/jugador",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}
