/**
 * After a restart, queued jobs should continue without anyone opening the page.
 * Calling our own /api/jobs once starts the worker (and keeps the heavy imports out of this file).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    setTimeout(() => {
        fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/jobs`).catch(() => undefined);
    }, 5000);
}
