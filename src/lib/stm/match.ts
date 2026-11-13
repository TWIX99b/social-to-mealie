// Name matching against Mealie foods / units – shared by the server (saving) and the review view (badges).

export interface MatchEntry {
    id: string;
    name: string;
    /** abbreviation (units) */
    short?: string;
    /** name, plural, abbreviations and aliases */
    variants: string[];
}

export interface MatchIndex {
    exact: Map<string, MatchEntry>;
    stems: Map<string, MatchEntry>;
}

export function normName(s: string | null | undefined): string {
    return (s || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

/** Very small plural fold (Zwiebeln → zwiebel, Tomaten/Tomate → tomat, onions → onion). */
export function stemName(s: string): string {
    const n = normName(s);
    if (n.length <= 4) return n;
    for (const end of ["en", "n", "e", "s"]) {
        if (n.endsWith(end)) return n.slice(0, -end.length);
    }
    return n;
}

export function buildIndex(entries: MatchEntry[]): MatchIndex {
    const exact = new Map<string, MatchEntry>();
    const stems = new Map<string, MatchEntry>();
    for (const e of entries) {
        for (const v of e.variants) {
            const n = normName(v);
            if (!n) continue;
            if (!exact.has(n)) exact.set(n, e);
            const st = stemName(n);
            if (!stems.has(st)) stems.set(st, e);
        }
    }
    return { exact, stems };
}

export function lookup(index: MatchIndex | null | undefined, text: string | null | undefined): MatchEntry | undefined {
    if (!index || !text) return undefined;
    const n = normName(text);
    if (!n) return undefined;
    return index.exact.get(n) ?? index.stems.get(stemName(n));
}
