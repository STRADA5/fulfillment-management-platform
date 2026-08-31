import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const item = url.searchParams.get("item");
  const version = url.searchParams.get("version");
  if (!provider || !item || !version) return NextResponse.json({ error: "Missing delivery identifiers." }, { status: 400 });
  const mode = url.searchParams.get("mode") === "print" ? "print" : "download";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_library_item_delivery" as never, { target_provider_id: provider, target_item_id: item, target_version_id: version, target_mode: mode } as never);
  if (error || !data) return NextResponse.json({ error: "Delivery denied." }, { status: error?.code === "42501" ? 403 : 400 });
  const payload = JSON.stringify(data, null, 2);
  return new NextResponse(payload, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="library-${item}.json"`, "cache-control": "no-store" } });
}
