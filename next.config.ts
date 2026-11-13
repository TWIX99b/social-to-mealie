import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

// Native binaries for local Whisper (onnxruntime) and image processing (sharp) must be
// traced into every route that can start the job worker.
const nativeFiles = [
    `./node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v6/linux/${process.arch}/**/*`,
    `./node_modules/.pnpm/@img+sharp-linux-${process.arch}@*/node_modules/@img/sharp-linux-${process.arch}/**/*`,
    `./node_modules/.pnpm/@img+sharp-libvips-linux-${process.arch}@*/node_modules/@img/sharp-libvips-linux-${process.arch}/**/*`,
];

const nextConfig: NextConfig = {
    output: "standalone",
    outputFileTracingIncludes: {
        "/api/get-url": nativeFiles,
        "/api/jobs": nativeFiles,
        "/api/jobs/[id]/[action]": nativeFiles,
        "/api/events": nativeFiles,
    },
};

export default withNextIntl(nextConfig);
