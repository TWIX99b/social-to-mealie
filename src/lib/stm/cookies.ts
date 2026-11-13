import fs from "fs";
import path from "path";
import { env } from "@/lib/constants";

/**
 * cookies.txt (Netscape format, mounted at /app/cookies.txt) – used by gallery-dl and for video frames.
 * We only read expiry dates of the login cookies, never their values.
 */

const LOGIN_COOKIES: Record<string, { domain: string; names: string[] }> = {
    Instagram: { domain: "instagram.com", names: ["sessionid"] },
    Facebook: { domain: "facebook.com", names: ["c_user", "xs"] },
    TikTok: { domain: "tiktok.com", names: ["sessionid", "sessionid_ss"] },
    YouTube: { domain: "youtube.com", names: ["SID", "__Secure-3PSID", "LOGIN_INFO"] },
};

export type CookieState = "ok" | "expiring" | "expired";
export interface CookieStatus {
    platform: string;
    state: CookieState;
    /** ISO date; null for session cookies */
    expires: string | null;
}

export type CookieFileState = "missing" | "empty" | "unreadable" | "noLogin" | "ok";

/** Why the cookie list is empty – shown in the settings. */
export function cookieFileState(): { state: CookieFileState; path: string } {
    const file = path.resolve("cookies.txt");
    const candidates = [env.COOKIES, file].filter(Boolean) as string[];
    let sawEmpty = false;
    for (const f of candidates) {
        try {
            const st = fs.statSync(f);
            if (!st.isFile()) continue;
            if (st.size === 0) {
                sawEmpty = true;
                continue;
            }
            try {
                fs.accessSync(f, fs.constants.R_OK);
            } catch {
                return { state: "unreadable", path: f };
            }
            return { state: cookieStatus().length ? "ok" : "noLogin", path: f };
        } catch {
            /* not there */
        }
    }
    return { state: sawEmpty ? "empty" : "missing", path: file };
}

export function cookiesFile(): string | null {
    const candidates = [env.COOKIES, path.resolve("cookies.txt")].filter(Boolean) as string[];
    for (const file of candidates) {
        try {
            const st = fs.statSync(file);
            if (st.isFile() && st.size > 0) return file;
        } catch {
            /* not a file */
        }
    }
    return null;
}

export function cookieStatus(now = Date.now()): CookieStatus[] {
    const file = cookiesFile();
    if (!file) return [];
    let text = "";
    try {
        text = fs.readFileSync(file, "utf8");
    } catch {
        return [];
    }
    const found: Record<string, number[]> = {};
    for (const raw of text.split(/\r?\n/)) {
        // "#HttpOnly_" prefixed lines are cookies too
        const line = raw.startsWith("#HttpOnly_") ? raw.slice(10) : raw;
        if (!line || line.startsWith("#")) continue;
        const parts = line.split("\t");
        if (parts.length < 7) continue;
        const [domain, , , , expiry, name] = parts;
        for (const [platform, def] of Object.entries(LOGIN_COOKIES)) {
            if (domain.replace(/^\./, "").endsWith(def.domain) && def.names.includes(name)) {
                (found[platform] ||= []).push(Number(expiry) || 0);
            }
        }
    }
    const week = 7 * 24 * 3600 * 1000;
    return Object.entries(found).map(([platform, expiries]) => {
        // 0 = session cookie (no fixed end)
        const fixed = expiries.filter((e) => e > 0);
        const earliest = fixed.length ? Math.min(...fixed) * 1000 : null;
        const state: CookieState = earliest === null ? "ok" : earliest < now ? "expired" : earliest - now < week ? "expiring" : "ok";
        return { platform, state, expires: earliest ? new Date(earliest).toISOString() : null };
    });
}

/** yt-dlp / gallery-dl error output that means "log in first". */
export function looksLikeLoginError(text: string): boolean {
    return /login|log in|sign in|cookies|rate-limit|not available|private|checkpoint|401|403/i.test(text);
}
