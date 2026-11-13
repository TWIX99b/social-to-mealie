import { listJobs, stm } from "@/lib/stm/store";
import type { StmEvent } from "@/lib/stm/types";
import { kickWorker } from "@/lib/stm/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-sent events: a snapshot first, then every job change and the live recipe while Claude writes. */
export async function GET(req: Request) {
    kickWorker();
    const encoder = new TextEncoder();
    const { bus } = stm();
    let cleanup = () => {};

    const stream = new ReadableStream({
        start(controller) {
            const send = (event: StmEvent) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                } catch {
                    cleanup();
                }
            };
            send({ type: "snapshot", jobs: listJobs() });
            const onEvent = (event: StmEvent) => send(event);
            bus.on("event", onEvent);
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": ping\n\n"));
                } catch {
                    cleanup();
                }
            }, 20_000);
            cleanup = () => {
                bus.off("event", onEvent);
                clearInterval(heartbeat);
            };
            req.signal.addEventListener("abort", () => {
                cleanup();
                try {
                    controller.close();
                } catch {
                    /* already closed */
                }
            });
        },
        cancel() {
            cleanup();
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
        },
    });
}
