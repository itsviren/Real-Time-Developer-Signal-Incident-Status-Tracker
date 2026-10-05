import { configured } from "@/lib/supabase-server";
import { liveDashboard } from "@/lib/dashboard-data";
import { previewDashboard } from "@/lib/preview";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(
      configured() ? await liveDashboard() : previewDashboard(),
      {
        headers: {
          "Cache-Control": "public, max-age=15, stale-while-revalidate=15",
        },
      },
    );
  } catch {
    console.error("Dashboard database query failed");
    return Response.json(
      { error: "Status data is temporarily unavailable. Please retry." },
      { status: 503 },
    );
  }
}
