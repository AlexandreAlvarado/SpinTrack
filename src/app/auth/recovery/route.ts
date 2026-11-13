import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authOrigin } from "@/lib/auth-flow";
import { grantRecovery, clearRecovery, consumeRecoveryIntent } from "@/lib/recovery";
export async function GET(request: NextRequest) {
  const destination = (path: string) => NextResponse.redirect(new URL(path, authOrigin()), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  await clearRecovery();
  try {
    const client = await createClient();
    const params = request.nextUrl.searchParams;
    const intended = await consumeRecoveryIntent(params.get("state"));
    const code = params.get("code");
    if (!intended || !code || params.has("error") || params.has("error_code") || params.has("token_hash")) return destination("/restablecer-contrasena?error=enlace");
    // PASSWORD_RECOVERY comes from the SDK's PKCE verifier, not URL parameters.
    let recoveryEvent = false;
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recoveryEvent = true;
    });
    const flowId = params.get("sb_flow_id");
    const result = await (async () => {
      try { return await client.auth.exchangeCodeForSession(code, flowId === null ? undefined : { flowId }); }
      finally { listener.subscription.unsubscribe(); }
    })();
    if (result.error || !recoveryEvent || !result.data.user || !result.data.session) return destination("/restablecer-contrasena?error=enlace");
    const { data, error } = await client.auth.getClaims();
    const sid = data?.claims?.session_id;
    if (error || data?.claims?.sub !== result.data.user.id || typeof sid !== "string") return destination("/restablecer-contrasena?error=enlace");
    await grantRecovery(result.data.user.id, sid);
    return destination("/restablecer-contrasena");
  } catch { return destination("/restablecer-contrasena?error=enlace"); }
}

