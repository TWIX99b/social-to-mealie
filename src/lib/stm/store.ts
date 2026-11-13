import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { env } from "@/lib/constants";
import { type MsgKey, isLang, translate } from "./i18n";
import { DEFAULT_SETTINGS, type Job, type Settings, type StmEvent } from "./types";

/**
 * Tiny JSON-file store. Everything lives in DATA_DIR (a Docker volume):
 *   store.json        jobs + settings
 *   images/<id>-<n>.jpg
 *   models/           local Whisper model cache
 * State is kept on globalThis so every Next.js route bundle shares one instance.
 */

interface StoreData {
    jobs: Job[];
    settings: Settings;
}

interface StmGlobal {
    data: StoreData;
    bus: EventEmitter;
    saveTimer: NodeJS.Timeout | null;
    workerRunning: boolean;
    lastCleanup: number;
}

const g = globalThis as unknown as { __stm?: StmGlobal };

export const dataDir = () => env.DATA_DIR;
export const imagesDir = () => path.join(env.DATA_DIR, "images");
const storeFile = () => path.join(env.DATA_DIR, "store.json");

function load(): StoreData {
    try {
        fs.mkdirSync(imagesDir(), { recursive: true });
    } catch (e) {
        console.error("Cannot create data directory", env.DATA_DIR, e);
    }
    try {
        const raw = JSON.parse(fs.readFileSync(storeFile(), "utf8"));
        const jobs: Job[] = Array.isArray(raw.jobs) ? raw.jobs : [];
        // Jobs interrupted by a restart go back into the queue.
        for (const j of jobs) {
            if (j.status === "downloading" || j.status === "transcribing" || j.status === "writing") {
                j.status = "queued";
            }
            if (j.status === "saving") j.status = "draft";
            if (typeof j.imageCount !== "number") j.imageCount = 0;
            if (!j.timings) j.timings = {};
        }
        const rawRules = raw.settings?.rules || {};
        // older stores (German-only version) had rules.german and no language
        const language = isLang(raw.settings?.language) ? raw.settings.language : raw.settings ? "de" : env.APP_LANGUAGE;
        return {
            jobs,
            settings: {
                ...DEFAULT_SETTINGS,
                ...(raw.settings || {}),
                language,
                rules: {
                    ...DEFAULT_SETTINGS.rules,
                    ...rawRules,
                    translate: typeof rawRules.translate === "boolean" ? rawRules.translate : rawRules.german ?? true,
                },
            },
        };
    } catch {
        return { jobs: [], settings: { ...DEFAULT_SETTINGS, language: env.APP_LANGUAGE, rules: { ...DEFAULT_SETTINGS.rules } } };
    }
}

export function stm(): StmGlobal {
    if (!g.__stm) {
        const bus = new EventEmitter();
        bus.setMaxListeners(100);
        g.__stm = { data: load(), bus, saveTimer: null, workerRunning: false, lastCleanup: 0 };
    }
    return g.__stm;
}

function persistSoon() {
    const s = stm();
    if (s.saveTimer) return;
    s.saveTimer = setTimeout(() => {
        s.saveTimer = null;
        try {
            const tmp = `${storeFile()}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(s.data, null, 1));
            fs.renameSync(tmp, storeFile());
        } catch (e) {
            console.error("Failed to persist store", e);
        }
    }, 300);
}

export function emit(event: StmEvent) {
    stm().bus.emit("event", event);
}

export function listJobs(): Job[] {
    cleanup();
    return stm().data.jobs.filter((j) => j.status !== "discarded");
}

export function getJob(id: string): Job | undefined {
    return stm().data.jobs.find((j) => j.id === id);
}

export function addJob(job: Job) {
    stm().data.jobs.unshift(job);
    persistSoon();
    emit({ type: "job", job });
}

export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
    const job = getJob(id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    persistSoon();
    if (job.status === "discarded") emit({ type: "remove", id });
    else emit({ type: "job", job });
    return job;
}

export function removeJob(id: string) {
    const s = stm();
    s.data.jobs = s.data.jobs.filter((j) => j.id !== id);
    removeImages(id);
    persistSoon();
    emit({ type: "remove", id });
}

export function getSettings(): Settings {
    return stm().data.settings;
}

export function saveSettings(next: Settings) {
    stm().data.settings = next;
    persistSoon();
}

export function imagePath(id: string, n: number) {
    return path.join(imagesDir(), `${id}-${n}.jpg`);
}

export function removeImages(id: string) {
    try {
        for (const f of fs.readdirSync(imagesDir())) {
            if (f.startsWith(`${id}-`)) fs.unlinkSync(path.join(imagesDir(), f));
        }
    } catch {
        /* ignore */
    }
}

/** History (saved / failed / duplicate / discarded) is kept RETENTION_DAYS; drafts stay until handled. */
export function cleanup() {
    const s = stm();
    const now = Date.now();
    if (now - s.lastCleanup < 60 * 60 * 1000) return;
    s.lastCleanup = now;
    const limit = now - env.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const keep: Job[] = [];
    for (const j of s.data.jobs) {
        const expired =
            ["saved", "failed", "duplicate", "discarded"].includes(j.status) &&
            new Date(j.updatedAt).getTime() < limit;
        if (expired) removeImages(j.id);
        else keep.push(j);
    }
    if (keep.length !== s.data.jobs.length) {
        s.data.jobs = keep;
        persistSoon();
    }
}

/** Server-side text in the configured recipe language. */
export function st(key: MsgKey, vars?: Record<string, string | number>) {
    return translate(getSettings().language, key, vars);
}
