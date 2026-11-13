import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "@/lib/constants";
import { cookiesFile } from "./cookies";

const run = promisify(execFile);

/**
 * Downloads the video in a small resolution and grabs a few stills (the finished dish is often
 * only shown in the video, not in the thumbnail). Best effort: returns [] on any problem.
 */
export async function extractFrames(url: string, count = 4): Promise<Buffer[]> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stm-frames-"));
    try {
        const cookies = cookiesFile();
        await run(
            env.YTDLP_PATH,
            [
                "-f", "bv*[height<=720]/b[height<=720]/bv*/b",
                "--no-playlist",
                "--max-filesize", "150M",
                "-o", path.join(dir, "video.%(ext)s"),
                ...(cookies ? ["--cookies", cookies] : []),
                "--", url,
            ],
            { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
        );
        const video = fs.readdirSync(dir).find((f) => f.startsWith("video."));
        if (!video) return [];
        const file = path.join(dir, video);

        const ffprobe = path.join(path.dirname(env.FFMPEG_PATH), "ffprobe");
        let duration = 0;
        try {
            const { stdout } = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { timeout: 20_000 });
            duration = Number.parseFloat(stdout) || 0;
        } catch {
            /* unknown duration */
        }
        // spread over the video, with a bias to the end where the plated dish usually is
        const marks = duration > 2 ? [0.3, 0.55, 0.8, 0.95].slice(0, count).map((p) => p * duration) : [1, 3, 6, 10].slice(0, count);

        const frames: Buffer[] = [];
        for (const [i, t] of marks.entries()) {
            const out = path.join(dir, `frame-${i}.jpg`);
            try {
                await run(env.FFMPEG_PATH, ["-y", "-ss", t.toFixed(2), "-i", file, "-frames:v", "1", "-q:v", "3", out], { timeout: 30_000 });
                if (fs.existsSync(out)) frames.push(fs.readFileSync(out));
            } catch {
                /* skip this frame */
            }
        }
        return frames;
    } catch (e) {
        console.warn("Could not extract video frames", e);
        return [];
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
