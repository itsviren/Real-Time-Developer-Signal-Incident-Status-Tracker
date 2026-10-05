import { configured } from "@/lib/supabase-server";
export function GET() {
  return Response.json(
    { ok: true, databaseConfigured: configured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
