import { configured } from "@/lib/supabase-server";
import { liveHistory } from "@/lib/dashboard-data";
import { previewHistory } from "@/lib/preview";
import { MONITORS } from "@/lib/monitors";
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("monitor"),
    index = MONITORS.findIndex((m) => m.id === id);
  if (index < 0)
    return Response.json({ error: "Unknown monitor" }, { status: 400 });
  try {
    return Response.json(
      {
        mode: configured() ? "live" : "preview",
        history: configured() ? await liveHistory(id!) : previewHistory(index),
      },
      { headers: { "Cache-Control": "public,max-age=30" } },
    );
  } catch {
    return Response.json({ error: "History unavailable" }, { status: 503 });
  }
}
