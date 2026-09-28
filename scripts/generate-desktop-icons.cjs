const fs = require("fs");
const zlib = require("zlib");

// CRC32 table
function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}
const crcTable = makeCrcTable();

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "binary");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// 8 Bezier segments from the uploaded star logo
const segments = [
  { p0: [50, 1], p1: [50.2, 34.0], p2: [58.0, 41.0], p3: [70.0, 30.0] },
  { p0: [70, 30], p1: [59.0, 42.0], p2: [66.0, 49.8], p3: [99.0, 50.0] },
  { p0: [99, 50], p1: [66.0, 50.2], p2: [59.0, 58.0], p3: [70.0, 70.0] },
  { p0: [70, 70], p1: [58.0, 59.0], p2: [50.2, 66.0], p3: [50.0, 99.0] },
  { p0: [50, 99], p1: [49.8, 66.0], p2: [42.0, 59.0], p3: [30.0, 70.0] },
  { p0: [30, 70], p1: [41.0, 58.0], p2: [34.0, 50.2], p3: [1.0, 50.0] },
  { p0: [1, 50], p1: [34.0, 49.8], p2: [41.0, 42.0], p3: [30.0, 30.0] },
  { p0: [30, 30], p1: [42.0, 41.0], p2: [49.8, 34.0], p3: [50.0, 1.0] },
];

// Sample polygon vertices
const POLY_STEPS = 64;
const starPolygon = [];
for (const seg of segments) {
  for (let i = 0; i < POLY_STEPS; i++) {
    const t = i / POLY_STEPS;
    const t1 = 1 - t;
    const x = t1*t1*t1*seg.p0[0] + 3*t1*t1*t*seg.p1[0] + 3*t1*t*t*seg.p2[0] + t*t*t*seg.p3[0];
    const y = t1*t1*t1*seg.p0[1] + 3*t1*t1*t*seg.p1[1] + 3*t1*t*t*seg.p2[1] + t*t*t*seg.p3[1];
    starPolygon.push([x, y]);
  }
}

// Ray casting point-in-polygon
function isPointInStar(px, py) {
  let inside = false;
  const n = starPolygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = starPolygon[i][0], yi = starPolygon[i][1];
    const xj = starPolygon[j][0], yj = starPolygon[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// macOS squircle / rounded rect distance
function isInsideSquircle(x, y, size, radius) {
  const half = size / 2;
  const dx = Math.abs(x - half);
  const dy = Math.abs(y - half);
  const r = radius;
  const straight = half - r;
  if (dx <= straight && dy <= half) return true;
  if (dy <= straight && dx <= half) return true;
  if (dx > straight && dy > straight) {
    const cx = dx - straight;
    const cy = dy - straight;
    return (cx * cx + cy * cy) <= (r * r);
  }
  return false;
}

function renderAppIcon(width, height, isMaskable = false) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = createChunk("IHDR", ihdrData);

  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  // macOS squircle radius (~22% of dimension)
  const squircleRadius = isMaskable ? 0 : width * 0.22;
  // Star scale factor
  const starScale = isMaskable ? (width * 0.70) / 100 : (width * 0.78) / 100;
  const starOffsetX = (width - starScale * 100) / 2;
  const starOffsetY = (height - starScale * 100) / 2;

  // 2x2 supersampling for smooth edges
  const subOffsets = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];

  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      let squircleHits = 0;
      let starHits = 0;

      for (const [ox, oy] of subOffsets) {
        const sx = x + ox;
        const sy = y + oy;

        if (isMaskable || isInsideSquircle(sx, sy, width, squircleRadius)) {
          squircleHits++;
        }

        // Map sx, sy to star coords [0, 100]
        const stX = (sx - starOffsetX) / starScale;
        const stY = (sy - starOffsetY) / starScale;
        if (stX >= 0 && stX <= 100 && stY >= 0 && stY <= 100) {
          if (isPointInStar(stX, stY)) {
            starHits++;
          }
        }
      }

      if (squircleHits === 0) {
        // Outside squircle (transparent)
        raw[offset++] = 0;
        raw[offset++] = 0;
        raw[offset++] = 0;
        raw[offset++] = 0;
        continue;
      }

      // Background gradient:
      // Sleek Obsidian canvas (#060e20 to #131b2e) with subtle top highlight
      const t = (x + y) / (width + height);
      let bgR = Math.round(6 + t * (19 - 6));
      let bgG = Math.round(14 + t * (27 - 14));
      let bgB = Math.round(32 + t * (46 - 32));

      // Star color: Bright crisp flare (White #ffffff with bright starflare accents)
      // Exactly reflecting the user's star graphic
      const starAlpha = starHits / 4.0;
      const squircleAlpha = squircleHits / 4.0;

      let r = bgR;
      let g = bgG;
      let b = bgB;
      let a = Math.round(255 * squircleAlpha);

      if (starAlpha > 0) {
        // Center of the star is pure crisp brilliant white
        const starR = 255;
        const starG = 255;
        const starB = 255;

        r = Math.round(r * (1 - starAlpha) + starR * starAlpha);
        g = Math.round(g * (1 - starAlpha) + starG * starAlpha);
        b = Math.round(b * (1 - starAlpha) + starB * starAlpha);
      }

      // Subtle top border rim light for macOS squircle
      if (y === 0 || y === 1 || (isInsideSquircle(x, y, width, squircleRadius) && !isInsideSquircle(x, y - 2, width, squircleRadius))) {
        r = Math.min(255, r + 25);
        g = Math.min(255, g + 30);
        b = Math.min(255, b + 50);
      }

      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const idat = createChunk("IDAT", zlib.deflateSync(raw));
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Write the files
fs.mkdirSync("public", { recursive: true });
console.log("Generating 512x512 desktop app icon...");
fs.writeFileSync("public/pwa-512x512.png", renderAppIcon(512, 512, false));

console.log("Generating 192x192 desktop app icon...");
fs.writeFileSync("public/pwa-192x192.png", renderAppIcon(192, 192, false));

console.log("Generating 512x512 maskable icon...");
fs.writeFileSync("public/pwa-maskable-512x512.png", renderAppIcon(512, 512, true));

console.log("Generating 180x180 Apple touch icon for macOS / iOS...");
fs.writeFileSync("public/apple-touch-icon.png", renderAppIcon(180, 180, false));

console.log("Generating 32x32 favicon...");
fs.writeFileSync("public/favicon.ico", renderAppIcon(32, 32, false));

// Also generate SVG version
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor">
  <path d="M 50 1 C 50.2 34.0, 58.0 41.0, 70.0 30.0 C 59.0 42.0, 66.0 49.8, 99.0 50.0 C 66.0 50.2, 59.0 58.0, 70.0 70.0 C 58.0 59.0, 50.2 66.0, 50.0 99.0 C 49.8 66.0, 42.0 59.0, 30.0 70.0 C 41.0 58.0, 34.0 50.2, 1.0 50.0 C 34.0 49.8, 41.0 42.0, 30.0 30.0 C 42.0 41.0, 49.8 34.0, 50.0 1.0 Z" />
</svg>`;
fs.writeFileSync("public/flux-logo.svg", svgContent);
fs.writeFileSync("public/icon.svg", svgContent);

console.log("All desktop app icons generated successfully!");
