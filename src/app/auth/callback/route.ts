import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";
import { authOrigin } from "@/lib/auth-flow";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = authOrigin();
  if (!supabaseConfigured()) return NextResponse.redirect(`${origin}/login?error=configuracion`);
  if (!code) return NextResponse.redirect(`${origin}/login?error=confirmacion`);
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=confirmacion`);
  return NextResponse.redirect(`${origin}/panel`);
}

