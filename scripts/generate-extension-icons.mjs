import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const sizes = [16, 32, 48, 128];
const styles = new Set(["beam", "minimal", "neon"]);

function drawRoundedSquare(ctx, size) {
  const radius = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
}

function drawBeamStyle(ctx, size) {
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#073BFF");
  gradient.addColorStop(0.42, "#00AFFF");
  gradient.addColorStop(1, "#6BFFD7");
  ctx.fillStyle = gradient;
  drawRoundedSquare(ctx, size);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  drawRoundedSquare(ctx, size);
  ctx.fill();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#F4FDFF";
  ctx.lineWidth = Math.max(1.8, size * 0.095);

  ctx.beginPath();
  ctx.moveTo(size * 0.305, size * 0.695);
  ctx.lineTo(size * 0.455, size * 0.39);
  ctx.lineTo(size * 0.615, size * 0.69);
  ctx.stroke();

  ctx.lineWidth = Math.max(1.6, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(size * 0.605, size * 0.52);
  ctx.lineTo(size * 0.805, size * 0.52);
  ctx.stroke();

  const cx = size * 0.76;
  const cy = size * 0.35;
  const r = Math.max(1.4, size * 0.048);
  ctx.fillStyle = "#F4FDFF";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const beamGradient = ctx.createLinearGradient(size * 0.46, size * 0.24, size * 0.69, size * 0.55);
  beamGradient.addColorStop(0, "rgba(244, 253, 255, 0.9)");
  beamGradient.addColorStop(1, "rgba(244, 253, 255, 0)");
  ctx.fillStyle = beamGradient;
  ctx.beginPath();
  ctx.moveTo(size * 0.455, size * 0.39);
  ctx.lineTo(size * 0.57, size * 0.24);
  ctx.lineTo(size * 0.69, size * 0.39);
  ctx.closePath();
  ctx.fill();

  const spark = Math.max(1.1, size * 0.03);
  ctx.lineWidth = Math.max(1, size * 0.026);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - spark * 1.6);
  ctx.lineTo(cx, cy - r - spark * 0.4);
  ctx.moveTo(cx, cy + r + spark * 0.4);
  ctx.lineTo(cx, cy + r + spark * 1.6);
  ctx.moveTo(cx - r - spark * 1.6, cy);
  ctx.lineTo(cx - r - spark * 0.4, cy);
  ctx.moveTo(cx + r + spark * 0.4, cy);
  ctx.lineTo(cx + r + spark * 1.6, cy);
  ctx.stroke();
}

function drawMinimalStyle(ctx, size) {
  const gradient = ctx.createLinearGradient(0, size * 0.05, size, size);
  gradient.addColorStop(0, "#0B1022");
  gradient.addColorStop(1, "#1A2C4E");
  ctx.fillStyle = gradient;
  drawRoundedSquare(ctx, size);
  ctx.fill();

  const panel = ctx.createLinearGradient(size * 0.2, size * 0.2, size * 0.8, size * 0.8);
  panel.addColorStop(0, "#2B66FF");
  panel.addColorStop(1, "#34D8FF");
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6, size * 0.14);
  ctx.fill();

  ctx.strokeStyle = "#EAF5FF";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.6, size * 0.085);
  ctx.beginPath();
  ctx.moveTo(size * 0.34, size * 0.66);
  ctx.lineTo(size * 0.47, size * 0.4);
  ctx.lineTo(size * 0.61, size * 0.66);
  ctx.stroke();

  ctx.lineWidth = Math.max(1.4, size * 0.065);
  ctx.beginPath();
  ctx.moveTo(size * 0.59, size * 0.5);
  ctx.lineTo(size * 0.72, size * 0.5);
  ctx.stroke();
}

function drawNeonStyle(ctx, size) {
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#FF4A7D");
  gradient.addColorStop(0.48, "#7A47FF");
  gradient.addColorStop(1, "#31E1FF");
  ctx.fillStyle = gradient;
  drawRoundedSquare(ctx, size);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  drawRoundedSquare(ctx, size);
  ctx.fill();

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.8, size * 0.095);
  ctx.beginPath();
  ctx.moveTo(size * 0.31, size * 0.69);
  ctx.lineTo(size * 0.46, size * 0.36);
  ctx.lineTo(size * 0.63, size * 0.69);
  ctx.stroke();

  ctx.strokeStyle = "#D9F8FF";
  ctx.lineWidth = Math.max(1.4, size * 0.072);
  ctx.beginPath();
  ctx.moveTo(size * 0.58, size * 0.5);
  ctx.lineTo(size * 0.81, size * 0.5);
  ctx.stroke();

  const cx = size * 0.79;
  const cy = size * 0.34;
  const r = Math.max(1.4, size * 0.048);
  ctx.fillStyle = "#D9F8FF";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawIcon(size, style) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  if (style === "beam") {
    drawBeamStyle(ctx, size);
  } else if (style === "minimal") {
    drawMinimalStyle(ctx, size);
  } else if (style === "neon") {
    drawNeonStyle(ctx, size);
  } else {
    throw new Error(`Unsupported style: ${style}`);
  }

  return canvas;
}

function parseArgs() {
  const styleArg = process.argv.find((arg) => arg.startsWith("--style="));
  const all = process.argv.includes("--all");
  const style = styleArg ? styleArg.slice("--style=".length) : "beam";
  if (!all && !styles.has(style)) {
    throw new Error(`Invalid --style value: ${style}. Expected one of: ${[...styles].join(", ")}`);
  }
  return { style, all };
}

async function renderStyle(style, outDir) {
  await mkdir(outDir, { recursive: true });
  for (const size of sizes) {
    const canvas = drawIcon(size, style);
    const png = await canvas.encode("png");
    await writeFile(resolve(outDir, `icon${size}.png`), png);
  }
}

async function main() {
  const { style, all } = parseArgs();
  const rootOutDir = resolve(process.cwd(), "extension", "public", "icons");

  if (all) {
    await renderStyle("beam", rootOutDir);
    for (const styleName of styles) {
      const variantOutDir = resolve(rootOutDir, "variants", styleName);
      await renderStyle(styleName, variantOutDir);
    }
    return;
  }

  await renderStyle(style, rootOutDir);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
