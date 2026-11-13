/**
 * Parse an incomplete JSON document as far as possible (used while Claude streams
 * the recipe). Closes open strings, arrays and objects; drops a dangling key or comma.
 */
function complete(text: string): string {
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (c === "\\") escaped = true;
            else if (c === '"') inString = false;
            continue;
        }
        if (c === '"') inString = true;
        else if (c === "{") stack.push("}");
        else if (c === "[") stack.push("]");
        else if (c === "}" || c === "]") stack.pop();
    }
    let out = text;
    if (inString) {
        if (escaped) out = out.slice(0, -1);
        out += '"';
    }
    out = out.replace(/[\s,:]+$/, "");
    return out + stack.reverse().join("");
}

export function parsePartialJson(text: string): any | undefined {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    // Cut back character by character from the end until a completion parses.
    const maxCut = Math.min(trimmed.length, 400);
    for (let cut = 0; cut <= maxCut; cut++) {
        const candidate = complete(trimmed.slice(0, trimmed.length - cut));
        try {
            return JSON.parse(candidate);
        } catch {
            /* keep cutting */
        }
    }
    return undefined;
}
