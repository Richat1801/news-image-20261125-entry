// "The World on Wednesday 25 November 2026" — six-panel editorial infographic.
// Fully procedural: own PNG encoder, float framebuffer, 5x7 bitmap font.
// Node 22, standard library only. Deterministic: no clock, no randomness, no network.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const fb = new Float32Array(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [251, 246, 234];
const PANEL: RGB = [255, 253, 246];
const NAVY: RGB = [22, 35, 61];
const INK: RGB = [28, 32, 44];
const AMBER: RGB = [232, 163, 61];
const CREAM: RGB = [251, 246, 234];
const RED: RGB = [166, 44, 32];
const BLUE: RGB = [38, 92, 140];
const GREEN: RGB = [31, 93, 66];
const GREY: RGB = [120, 124, 132];
const LIGHTBLUE: RGB = [158, 198, 224];

function px(x: number, y: number, c: RGB): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = Math.round(y); j < Math.round(y + h); j++) {
    for (let i = Math.round(x); i < Math.round(x + w); i++) px(i, j, c);
  }
}

function frame(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let j = Math.round(cy - r); j <= Math.round(cy + r); j++) {
    for (let i = Math.round(cx - r); i <= Math.round(cx + r); i++) {
      const dx = i - cx;
      const dy = j - cy;
      if (dx * dx + dy * dy <= r2) px(i, j, c);
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const half = Math.floor(t / 2);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps);
    const y = Math.round(y0 + (dy * s) / steps);
    for (let a = -half; a <= half; a++) {
      for (let b = -half; b <= half; b++) px(x + a, y + b, c);
    }
  }
}

function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.floor(Math.min(x0, x1, x2));
  const maxX = Math.ceil(Math.max(x0, x1, x2));
  const minY = Math.floor(Math.min(y0, y1, y2));
  const maxY = Math.ceil(Math.max(y0, y1, y2));
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let j = minY; j <= maxY; j++) {
    for (let i = minX; i <= maxX; i++) {
      const a = ((x1 - i) * (y2 - j) - (y1 - j) * (x2 - i)) / d;
      const b = ((x2 - i) * (y0 - j) - (y2 - j) * (x0 - i)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) px(i, j, c);
    }
  }
}

// 5x7 bitmap font, uppercase + digits + punctuation.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "01100"],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of s) {
    const g = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === "1") {
          rect(cx + col * scale, cy + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - textWidth(s, scale) / 2, y, s, scale, c);
}

// ---- pictograms (drawn in the panel's top zone, centred on cx, zone top py) ----
function picTower(cx: number, py: number): void {
  // Riyadh tower: tall block, windows, antenna, blast star, small drone.
  rect(cx - 24, py + 34, 48, 74, NAVY);
  rect(cx - 2, py + 16, 4, 18, NAVY);
  circle(cx, py + 12, 4, RED);
  for (let r = 0; r < 4; r++) {
    for (let cI = 0; cI < 3; cI++) {
      rect(cx - 16 + cI * 13, py + 44 + r * 15, 7, 8, AMBER);
    }
  }
  // blast star top-right
  const bx = cx + 62;
  const by = py + 30;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    line(bx, by, bx + Math.cos(a) * 26, by + Math.sin(a) * 26, 4, RED);
  }
  circle(bx, by, 9, AMBER);
  // drone top-left: body with two rotor bars
  rect(cx - 82, py + 24, 34, 10, INK);
  line(cx - 86, py + 18, cx - 44, py + 18, 4, INK);
  line(cx - 86, py + 36, cx - 44, py + 36, 4, INK);
  circle(cx - 86, py + 18, 3, GREY);
  circle(cx - 44, py + 18, 3, GREY);
  circle(cx - 86, py + 36, 3, GREY);
  circle(cx - 44, py + 36, 3, GREY);
  rect(cx - 4, py + 108, 8, 4, GREY);
  line(cx - 60, py + 108, cx + 60, py + 108, 3, GREY);
}

function picRocket(cx: number, py: number): void {
  // Shenzhou-24: rocket climbing past stars.
  for (const [sx, sy] of [[-86, 22], [-70, 66], [74, 18], [88, 58], [58, 92]] as const) {
    line(cx + sx - 5, cy0(py, sy), cx + sx + 5, cy0(py, sy), 3, AMBER);
    line(cx + sx, cy0(py, sy) - 5, cx + sx, cy0(py, sy) + 5, 3, AMBER);
  }
  tri(cx, py + 10, cx - 15, py + 38, cx + 15, py + 38, RED);
  rect(cx - 15, py + 38, 30, 52, NAVY);
  rect(cx - 15, py + 52, 30, 4, CREAM);
  circle(cx, py + 68, 6, LIGHTBLUE);
  tri(cx - 15, py + 74, cx - 30, py + 96, cx - 15, py + 90, RED);
  tri(cx + 15, py + 74, cx + 30, py + 96, cx + 15, py + 90, RED);
  tri(cx - 9, py + 90, cx + 9, py + 90, cx, py + 112, AMBER);
  tri(cx - 5, py + 90, cx + 5, py + 90, cx, py + 102, RED);
  line(cx - 52, py + 104, cx - 34, py + 104, 3, GREY);
  line(cx + 34, py + 104, cx + 52, py + 104, 3, GREY);
}
function cy0(py: number, off: number): number {
  return py + off;
}

function picMonitor(cx: number, py: number): void {
  // Hacked terminal: monitor with a red warning mark, broken lock below.
  rect(cx - 56, py + 22, 112, 66, NAVY);
  rect(cx - 48, py + 30, 96, 50, [214, 228, 238]);
  drawText(cx - 11, py + 38, "!", 3, RED);
  rect(cx - 16, py + 88, 32, 6, NAVY);
  rect(cx - 30, py + 94, 60, 6, NAVY);
  // warning triangle left
  tri(cx - 88, py + 66, cx - 70, py + 30, cx - 52, py + 66, AMBER);
  drawText(cx - 76, py + 40, "!", 2, NAVY);
  // warning triangle right
  tri(cx + 52, py + 66, cx + 70, py + 30, cx + 88, py + 66, AMBER);
  drawText(cx + 66, py + 40, "!", 2, NAVY);
}

function picBars(cx: number, py: number): void {
  // Rising toll: three bars and a steep red arrow.
  const base = py + 100;
  rect(cx - 66, base - 34, 30, 34, GREY);
  rect(cx - 24, base - 58, 30, 58, BLUE);
  rect(cx + 18, base - 84, 30, 84, RED);
  line(cx - 78, base, cx + 66, base, 4, NAVY);
  line(cx - 70, py + 22, cx + 56, py + 8, 4, RED);
  tri(cx + 56, py + 8, cx + 38, py + 6, cx + 52, py + 24, RED);
}

function picDroneSea(cx: number, py: number): void {
  // MQ-9 drone falling over Hormuz waves: quadcopter body, four rotor arms.
  rect(cx - 16, py + 36, 32, 12, INK);
  line(cx - 14, py + 42, cx - 52, py + 26, 4, INK);
  line(cx + 14, py + 42, cx + 52, py + 26, 4, INK);
  line(cx - 14, py + 42, cx - 52, py + 58, 4, INK);
  line(cx + 14, py + 42, cx + 52, py + 58, 4, INK);
  circle(cx - 54, py + 24, 7, GREY);
  circle(cx + 54, py + 24, 7, GREY);
  circle(cx - 54, py + 60, 7, GREY);
  circle(cx + 54, py + 60, 7, GREY);
  circle(cx - 64, py + 30, 4, GREY);
  circle(cx - 76, py + 22, 3, GREY);
  circle(cx - 86, py + 14, 3, GREY);
  // waves
  for (let r = 0; r < 3; r++) {
    const wy = py + 76 + r * 12;
    for (let x = cx - 84; x < cx + 84; x += 16) {
      line(x, wy, x + 8, wy - 4, 3, BLUE);
      line(x + 8, wy - 4, x + 16, wy, 3, BLUE);
    }
  }
}

function picPlane(cx: number, py: number): void {
  // Paper plane on a dashed route, heading up-right.
  for (let k = 0; k < 6; k++) {
    circle(cx - 84 + k * 14, py + 96 - k * 10, 3, GREY);
  }
  tri(cx - 10, py + 22, cx + 68, py + 44, cx - 10, py + 66, NAVY);
  tri(cx - 10, py + 22, cx - 10, py + 66, cx + 20, py + 44, LIGHTBLUE);
  line(cx - 10, py + 22, cx + 20, py + 44, 3, NAVY);
  line(cx - 10, py + 66, cx + 20, py + 44, 3, NAVY);
  // small sun / cloud
  circle(cx + 74, py + 16, 12, AMBER);
  circle(cx - 78, py + 26, 10, LIGHTBLUE);
  circle(cx - 64, py + 30, 12, LIGHTBLUE);
  circle(cx - 50, py + 26, 9, LIGHTBLUE);
}

// ---- panels ----
interface Panel {
  pic: (cx: number, py: number) => void;
  head: string;
  body1: string;
  body2: string;
  accent: RGB;
}

const PANELS: Panel[] = [
  {
    pic: picTower,
    head: "RIYADH TOWER HIT",
    body1: "HOUTHI DRONE WOUNDS 11",
    body2: "SAUDI JETS HIT HODEIDAH",
    accent: RED,
  },
  {
    pic: picRocket,
    head: "SHENZHOU-24 LIFTS OFF",
    body1: "PAKISTAN'S FIRST ASTRONAUT",
    body2: "RIDES CHINA'S ROCKET",
    accent: BLUE,
  },
  {
    pic: picMonitor,
    head: "CIA SYSTEMS HACKED",
    body1: "CYBERATTACK HITS",
    body2: "UNCLASSIFIED NETWORK",
    accent: RED,
  },
  {
    pic: picBars,
    head: "700,000 WAR DEAD",
    body1: "LEAKED RECORDS REVEAL",
    body2: "THE RUSSIAN TOLL",
    accent: RED,
  },
  {
    pic: picDroneSea,
    head: "US DRONE DOWNED",
    body1: "IRAN SAYS IT SHOT DOWN",
    body2: "AN MQ-9 OVER HORMUZ",
    accent: BLUE,
  },
  {
    pic: picPlane,
    head: "ABREGO GARCIA LEAVES",
    body1: "SELF-DEPORTS TO SPAIN",
    body2: "ENDING 2-YEAR FIGHT",
    accent: GREEN,
  },
];

function drawPanel(px0: number, py0: number, p: Panel): void {
  const w = 488;
  const h = 252;
  rect(px0, py0, w, h, PANEL);
  frame(px0, py0, w, h, 3, NAVY);
  p.pic(px0 + w / 2, py0 + 14);
  rect(px0 + 16, py0 + 130, w - 32, 5, p.accent);
  drawTextCentered(px0 + w / 2, py0 + 146, p.head, 3, NAVY);
  drawTextCentered(px0 + w / 2, py0 + 180, p.body1, 2, INK);
  drawTextCentered(px0 + w / 2, py0 + 204, p.body2, 2, INK);
}

// ---- compose ----
rect(0, 0, W, H, PAPER);
// header
rect(0, 0, W, 104, NAVY);
drawTextCentered(W / 2, 12, "THE WORLD ON WEDNESDAY", 3, CREAM);
drawTextCentered(W / 2, 46, "25 NOVEMBER 2026", 5, AMBER);
rect(0, 104, W, 4, AMBER);
// panels: 2 cols x 3 rows
const rows = [120, 388, 656];
for (let i = 0; i < 6; i++) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  drawPanel(16 + col * (488 + 16), rows[row], PANELS[i]);
}
// footer
rect(0, 924, W, 100, NAVY);
rect(0, 924, W, 4, AMBER);
drawTextCentered(
  W / 2,
  944,
  "ALSO: HAMAS SECURITY CHIEF KILLED IN GAZA - CONGO REBELS PULL BACK FROM BUNIA",
  2,
  CREAM
);
drawTextCentered(
  W / 2,
  972,
  "AUSTRALIA-SOLOMONS PACT - SENEGAL'S AFCON TITLE BACK - REAL MADRID 5-1 PSV",
  2,
  CREAM
);

// ---- PNG encode ----
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  for (let x = 0; x < W; x++) {
    const si = (y * W + x) * 3;
    const di = y * (1 + W * 3) + 1 + x * 3;
    raw[di] = Math.max(0, Math.min(255, Math.round(fb[si])));
    raw[di + 1] = Math.max(0, Math.min(255, Math.round(fb[si + 1])));
    raw[di + 2] = Math.max(0, Math.min(255, Math.round(fb[si + 2])));
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "entry.png"), png);
console.log(`wrote ${png.length} bytes`);
