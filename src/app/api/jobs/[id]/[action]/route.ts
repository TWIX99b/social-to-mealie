import { getJob, st } from "@/lib/stm/store";
import type { DraftRecipe } from "@/lib/stm/types";
import { friendlyMealieError, requeue, saveJob } from "@/lib/stm/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; action: string }> };

function cleanRecipe(input: any): DraftRecipe {
    const r = input && typeof input === "object" ? input : {};
    const num = (v: any) => {
        if (v === null || v === undefined || v === "") return null;
        const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
        return Number.isFinite(n) ? n : null;
    };
    return {
        name: String(r.name || "").trim(),
        description: String(r.description || ""),
        servings: num(r.servings),
        totalTime: r.totalTime ? String(r.totalTime) : null,
        prepTime: r.prepTime ? String(r.prepTime) : null,
        ingredients: Array.isArray(r.ingredients)
            ? r.ingredients
                  .filter((i: any) => i && String(i.food || "").trim())
                  .map((i: any) => ({
                      quantity: num(i.quantity),
                      unit: i.unit ? String(i.unit).trim() || null : null,
                      food: String(i.food).trim(),
                      note: i.note ? String(i.note).trim() || null : null,
                  }))
            : [],
        instructions: Array.isArray(r.instructions) ? r.instructions.map(String).filter((t: string) => t.trim()) : [],
        notes: Array.isArray(r.notes) ? r.notes.filter((n: any) => n?.text).map((n: any) => ({ title: String(n.title || ""), text: String(n.text) })) : [],
        tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
        category: r.category ? String(r.category) : null,
    };
}

export async function POST(req: Request, { params }: Ctx) {
    const { id, action } = await params;
    const job = getJob(id);
    if (!job || job.status === "discarded") return Response.json({ error: st("srv.notFound") }, { status: 404 });
    const body = await req.json().catch(() => ({}));

    switch (action) {
        case "save": {
            if (!["draft", "failed"].includes(job.status)) {
                return Response.json({ error: st("srv.onlyDrafts") }, { status: 409 });
            }
            const recipe = cleanRecipe(body.recipe ?? job.recipe);
            if (!recipe.name) return Response.json({ error: st("srv.noTitle") }, { status: 400 });
            try {
                const saved = await saveJob(id, recipe, Number(body.imageIndex) || 0);
                return Response.json({ job: saved });
            } catch (e: any) {
                return Response.json({ error: st("srv.saveFailed", { msg: friendlyMealieError(e) }) }, { status: 502 });
            }
        }
        case "retry":
            return Response.json({ job: requeue(id, { mode: "full", force: false }) });
        case "force":
            return Response.json({ job: requeue(id, { mode: "full", force: true, duplicateOf: undefined }) });
        case "rewrite": {
            if (!job.recipe) return Response.json({ job: requeue(id, { mode: "full" }) });
            const edited = body.recipe ? cleanRecipe(body.recipe) : job.recipe;
            return Response.json({
                job: requeue(id, { mode: "rewrite", hint: typeof body.hint === "string" ? body.hint : "", recipe: edited }),
            });
        }
        default:
            return Response.json({ error: st("srv.unknownAction") }, { status: 400 });
    }
}
