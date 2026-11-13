import { getJob, removeJob } from "@/lib/stm/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params;
    const job = getJob(id);
    if (!job || job.status === "discarded") return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    return Response.json({ job });
}

/** Verwerfen: removes the job and its images. */
export async function DELETE(_req: Request, { params }: Ctx) {
    const { id } = await params;
    const job = getJob(id);
    if (!job) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    if (["downloading", "transcribing", "writing", "saving"].includes(job.status)) {
        return Response.json({ error: "Läuft gerade – bitte kurz warten" }, { status: 409 });
    }
    removeJob(id);
    return Response.json({ ok: true });
}
