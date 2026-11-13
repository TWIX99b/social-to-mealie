import { getMatchData } from "@/lib/stm/mealie-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Mealie foods and units (names, plurals, aliases) for the review view. */
export async function GET() {
    try {
        return Response.json(await getMatchData());
    } catch (e: any) {
        return Response.json({ foods: [], units: [], error: String(e?.message || e) }, { status: 502 });
    }
}
