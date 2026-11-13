import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
const name = "liga-recovery";
const intentName = "liga-recovery-intent";
export async function beginRecovery() {
  const nonce = randomUUID();
  const value = `${nonce}:${Date.now() + 3600000}`;
  (await cookies()).set(intentName, `${value}:${signature(value)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
  await clearRecovery();
  return nonce;
}
export async function consumeRecoveryIntent(nonce: string | null) {
  const store = await cookies();
  const proof = store.get(intentName)?.value;
  store.delete(intentName);
  if (!nonce || !proof) return false;
  const parts = proof.split(":");
  if (parts.length !== 3 || parts[0] !== nonce || !Number.isFinite(Number(parts[1])) || Number(parts[1]) <= Date.now()) return false;
  const expected = signature(parts.slice(0, 2).join(":"));
  return /^[a-f0-9]{64}$/.test(parts[2]) && timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected));
}
function signature(value: string) {
  const secret = process.env.AUTH_RECOVERY_SECRET;
  if (!secret || secret.length < 32) throw new Error("Configura AUTH_RECOVERY_SECRET (mínimo 32 caracteres aleatorios)");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export async function grantRecovery(userId: string, sessionId: string) {
  const value = `${userId}:${sessionId}:${Date.now() + 15 * 60 * 1000}`;
  (await cookies()).set(name, `${value}:${signature(value)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 900 });
}
export async function hasRecovery(userId: string, sessionId: string) {
  const proof = (await cookies()).get(name)?.value;
  if (!proof) return false;
  const parts = proof.split(":");
  if (parts.length !== 4 || parts[0] !== userId || parts[1] !== sessionId || !Number.isFinite(Number(parts[2])) || Number(parts[2]) <= Date.now()) return false;
  const expected = signature(parts.slice(0, 3).join(":"));
  return /^[a-f0-9]{64}$/.test(parts[3]) && timingSafeEqual(Buffer.from(parts[3]), Buffer.from(expected));
}
export async function clearRecovery() { (await cookies()).delete(name); }
