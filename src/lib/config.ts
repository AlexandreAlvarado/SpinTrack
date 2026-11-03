export function supabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(
    url && key &&
    /^https:\/\/.+\.supabase\.co$/.test(url) &&
    !url.includes("TU-PROYECTO") &&
    key !== "TU_CLAVE_PUBLICA"
  );
}

export function getSupabaseConfig() {
  if (!supabaseConfigured()) {
    throw new Error("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local");
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}
