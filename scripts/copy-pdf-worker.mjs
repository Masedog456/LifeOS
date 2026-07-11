/**
 * Copies the installed pdf.js worker into public/ so it's served as a
 * same-version static asset with a JS MIME type (module worker). Runs on
 * predev/prebuild, so the worker always matches the installed pdfjs-dist
 * and the 1.2MB vendored file is never committed. See lib/ingestion/pdfExtract.ts.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = resolve(root, "public");
const dest = resolve(destDir, "pdf.worker.min.js");

if (!existsSync(src)) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found; skipping.");
  process.exit(0);
}
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-pdf-worker] copied worker → public/pdf.worker.min.js");
