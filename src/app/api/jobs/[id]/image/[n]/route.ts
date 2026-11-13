import fs from "fs";
import { getJob, imagePath } from "@/lib/stm/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; n: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const { id, n } = await params;
    const index = Number.parseInt(n, 10);
    const job = getJob(id);
    if (!job || !Number.isInteger(index) || index < 0 || index >= job.imageCount) {
        return new Response("Nicht gefunden", { status: 404 });
    }
    try {
        const data = fs.readFileSync(imagePath(id, index));
        return new Response(new Uint8Array(data), {
            headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
        });
    } catch {
        return new Response("Nicht gefunden", { status: 404 });
    }
}
