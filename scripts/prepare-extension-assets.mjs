import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const srcWasmDir = resolve(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dstWasmDir = resolve(root, "extension", "public", "mediapipe", "wasm");

async function main() {
  await mkdir(dstWasmDir, { recursive: true });
  await cp(srcWasmDir, dstWasmDir, { recursive: true });
  process.stdout.write(`Copied MediaPipe WASM assets to ${dstWasmDir}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exitCode = 1;
});
