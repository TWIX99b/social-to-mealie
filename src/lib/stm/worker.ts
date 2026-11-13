import fs from "fs";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { env } from "@/lib/constants";
import { getTranscription } from "@/lib/ai";
import { downloadMediaWithYtDlp } from "@/lib/yt-dlp";
import { writeRecipeWithClaude } from "./claude";
import { findDuplicate, getCategories, getTags, getUnits, matchIngredients, saveRecipe } from "./mealie-api";
import { notify } from "./notify";
import { addJob, emit, getJob, getSettings, imagePath, listJobs, removeImages, st, stm, updateJob } from "./store";
import type { DraftRecipe, Job } from "./types";

export function detectPlatform(url: string): string {
    try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (host.includes("instagram")) return "Instagram";
        if (host.includes("tiktok")) return "TikTok";
        if (host.includes("youtu")) return "YouTube";
        if (host.includes("facebook") || host.includes("fb.")) return "Facebook";
        if (host.includes("pinterest") || host.includes("pin.it")) return "Pinterest";
        return host;
    } catch {
        return "Link";
    }
}

const TRACKING = /^(utm_.*|igsh|igshid|si|fbclid|gclid|_t|_r|share_app_id|share_item_id|is_from_webapp|sender_device|feature|mibextid|rdid|ref|ref_src)$/i;

/** Drops tracking parameters so the same post is recognised again (duplicate check, orgURL). */
export function cleanUrl(raw: string): string {
    try {
        const u = new URL(raw);
        for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
        u.hash = "";
        return u.toString();
    } catch {
        return raw;
    }
}

/** Pull every http(s) URL out of a text (share sheets often add extra words). */
export function extractUrls(text: string): string[] {
    const found = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
    const urls = found.map((u) => cleanUrl(u.replace(/[),.;!?]+$/, "")));
    return [...new Set(urls)];
}

export function createJob(url: string, opts: { source: string; direct: boolean }): Job {
    // the same link shared twice while it is still waiting, running or in review → reuse that job
    const open = listJobs().find((j) => j.url === url && ["queued", "downloading", "transcribing", "writing", "draft", "saving"].includes(j.status));
    if (open) return open;
    const now = new Date().toISOString();
    const job: Job = {
        id: randomUUID().slice(0, 12),
        url,
        status: "queued",
        source: opts.source,
        direct: opts.direct,
        createdAt: now,
        updatedAt: now,
        platform: detectPlatform(url),
        imageCount: 0,
        timings: {},
        mode: "full",
    };
    addJob(job);
    kickWorker();
    return job;
}

export function requeue(id: string, patch: Partial<Job>) {
    const job = updateJob(id, { ...patch, status: "queued", error: undefined });
    kickWorker();
    return job;
}

export function kickWorker() {
    const s = stm();
    if (s.workerRunning) return;
    s.workerRunning = true;
    void (async () => {
        try {
            while (true) {
                const next = listJobs()
                    .filter((j) => j.status === "queued")
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
                if (!next) break;
                await processJob(next.id);
            }
        } finally {
            s.workerRunning = false;
        }
    })();
}

async function storeImage(id: string, n: number, source: string): Promise<boolean> {
    try {
        let input: Buffer;
        if (source.startsWith("data:")) {
            input = Buffer.from(source.split(",")[1] || "", "base64");
        } else {
            const res = await fetch(source, { signal: AbortSignal.timeout(20_000) });
            if (!res.ok) return false;
            input = Buffer.from(await res.arrayBuffer());
        }
        const out = await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
        fs.writeFileSync(imagePath(id, n), out);
        return true;
    } catch (e) {
        console.warn("Could not store image", e);
        return false;
    }
}

function friendlyDownloadError(job: Job): string {
    if (job.platform === "Instagram" || job.platform === "Facebook") {
        return st("srv.dlCookies", { platform: job.platform });
    }
    return st("srv.dlGeneric");
}

export function friendlyMealieError(e: any): string {
    const msg = String(e?.message || e);
    if (/→ 40[13]/.test(msg)) return st("srv.mealieToken");
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|timeout/i.test(msg)) return st("srv.mealieDown");
    return msg;
}

function modelFor(job: Job): string {
    const m = getSettings().model;
    if (m === "fast") return env.CLAUDE_MODEL_FAST;
    if (m === "smart") return env.CLAUDE_MODEL_SMART;
    return job.mode === "rewrite" ? env.CLAUDE_MODEL_SMART : env.CLAUDE_MODEL_FAST;
}

async function processJob(id: string) {
    let job = getJob(id);
    if (!job) return;
    const rewrite = job.mode === "rewrite" && Boolean(job.recipe);
    const stamp = () => new Date().toISOString();

    try {
        if (!rewrite) {
            // 1) duplicate check before spending anything
            if (!job.force) {
                updateJob(id, { status: "downloading", stageStartedAt: stamp() });
                const dup = await findDuplicate(job.url);
                if (dup) {
                    updateJob(id, { status: "duplicate", duplicateOf: dup });
                    await notify(st("push.duplicateTitle"), st("push.duplicateText", { name: dup.name }), `/?tab=verlauf`);
                    return;
                }
            }

            // 2) download
            let t0 = Date.now();
            removeImages(id);
            updateJob(id, { status: "downloading", stageStartedAt: stamp(), timings: {}, imageCount: 0 });
            let media;
            try {
                media = await downloadMediaWithYtDlp(job.url);
            } catch (e) {
                console.error("Download failed", e);
                throw new Error(friendlyDownloadError(job));
            }
            let count = 0;
            const sources = [
                ...(media.thumbnail && media.thumbnail !== "notfound" ? [media.thumbnail] : []),
                ...(media.images || []),
            ];
            for (const src of sources.slice(0, 8)) {
                if (await storeImage(id, count, src)) count++;
            }
            job = updateJob(id, {
                title: media.title || undefined,
                description: media.description && media.description !== "No description found" ? media.description : "",
                imageCount: count,
                timings: { download: Date.now() - t0 },
            })!;

            // 3) transcription (a failure here is not fatal – Claude still has text and images)
            let transcript = "";
            if (media.blob) {
                t0 = Date.now();
                updateJob(id, { status: "transcribing", stageStartedAt: stamp() });
                try {
                    transcript = await getTranscription(media.blob);
                } catch (e) {
                    console.warn("Transcription failed, continuing without", e);
                }
                job = updateJob(id, { transcript, timings: { ...job.timings, transcribe: Date.now() - t0 } })!;
            }
        }

        // 4) Claude writes
        const t1 = Date.now();
        const model = modelFor(job);
        updateJob(id, { status: "writing", stageStartedAt: stamp(), model });
        const [units, tags, categories] = await Promise.all([
            getUnits().then((u) => u.map((x) => x.abbreviation || x.name)).catch(() => [] as string[]),
            getTags().then((t) => t.map((x) => x.name)).catch(() => [] as string[]),
            getCategories().then((c) => c.map((x) => x.name)).catch(() => [] as string[]),
        ]);
        const imageFiles = Array.from({ length: job.imageCount }, (_, n) => imagePath(id, n));
        const recipe = await writeRecipeWithClaude(
            {
                url: job.url,
                title: job.title,
                description: job.description,
                transcript: job.transcript,
                imageFiles,
                settings: getSettings(),
                units: [...new Set(units.filter(Boolean))],
                tags,
                categories,
                hint: job.hint,
                previous: rewrite ? job.recipe : undefined,
                model,
            },
            (partial) => emit({ type: "partial", id, recipe: partial }),
        );
        recipe.ingredients = await matchIngredients(recipe.ingredients);
        job = updateJob(id, {
            recipe,
            timings: { ...getJob(id)!.timings, write: Date.now() - t1 },
            mode: "full",
            force: false,
        })!;

        // 5) draft or save directly
        if (job.direct) {
            try {
                const saved = await saveJob(id, recipe, 0);
                await notify(st("push.savedTitle"), st("push.savedText", { name: recipe.name }), saved?.mealieUrl || "/?tab=verlauf");
            } catch (e: any) {
                await notify(st("push.saveFailedTitle"), `${recipe.name}: ${friendlyMealieError(e)}`, `/?draft=${id}`);
            }
        } else {
            updateJob(id, { status: "draft" });
            await notify(st("push.readyTitle"), recipe.name || st("push.newDraft"), `/?draft=${id}`);
        }
    } catch (e: any) {
        console.error("Job failed", id, e);
        const raw = String(e?.message || "");
        const message =
            e?.name === "TimeoutError" || e?.name === "AbortError"
                ? st("srv.timeout")
                : raw.startsWith("Mealie")
                  ? friendlyMealieError(e)
                  : raw || st("srv.unknown");
        updateJob(id, { status: "failed", error: message });
        await notify(st("push.failedTitle"), message, "/?tab=verlauf");
    }
}

export async function saveJob(id: string, recipe: DraftRecipe, imageIndex: number) {
    const job = getJob(id);
    if (!job) throw new Error(st("srv.jobMissing"));
    const t0 = Date.now();
    updateJob(id, { status: "saving", recipe, error: undefined, stageStartedAt: new Date().toISOString() });
    try {
        const file = job.imageCount > 0 ? imagePath(id, Math.min(Math.max(0, imageIndex), job.imageCount - 1)) : null;
        const result = await saveRecipe(job.url, recipe, file);
        return updateJob(id, {
            status: "saved",
            mealieSlug: result.slug,
            mealieUrl: result.url,
            error: undefined,
            timings: { ...job.timings, save: Date.now() - t0 },
        });
    } catch (e: any) {
        updateJob(id, { status: "draft", error: st("srv.saveFailed", { msg: friendlyMealieError(e) }) });
        throw e;
    }
}
