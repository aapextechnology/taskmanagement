// Generates the PWA icon set (T-103) as 8-bit grayscale PNGs — no image
// dependency, just zlib. The mark is a 5x7 bitmap lockup
// so it stays legible at 192px and matches the monochrome theme.
//
// Regenerate with:  node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const GLYPHS = {
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** pixels: Uint8Array of size*size grayscale samples */
function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: grayscale
  // 10..12 = compression/filter/interlace, all 0

  // one filter byte (0 = None) per scanline
  const raw = Buffer.alloc((size + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0;
    Buffer.from(pixels.subarray(y * size, (y + 1) * size)).copy(
      raw,
      y * (size + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Black canvas with the white wordmark centred.
 * `coverage` is the fraction of the canvas width the lockup may occupy —
 * maskable icons need to stay inside the 80% safe zone, so they use less.
 */
function drawIcon(size, coverage) {
  const pixels = new Uint8Array(size * size); // 0 = black
  const letters = ["R", "V", "C"];
  const cols = letters.length * 5 + (letters.length - 1); // 1px letter spacing
  const scale = Math.max(1, Math.floor((size * coverage) / cols));
  const markW = cols * scale;
  const markH = 7 * scale;
  const originX = Math.floor((size - markW) / 2);
  const originY = Math.floor((size - markH) / 2);

  letters.forEach((letter, index) => {
    const rows = GLYPHS[letter];
    const offsetX = originX + index * 6 * scale;
    rows.forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit !== "1") return;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = offsetX + rx * scale + dx;
            const y = originY + ry * scale + dy;
            pixels[y * size + x] = 255; // white
          }
        }
      });
    });
  });

  return encodePng(size, pixels);
}

const targets = [
  ["public/icon-192.png", 192, 0.72],
  ["public/icon-512.png", 512, 0.72],
  ["public/icon-maskable-512.png", 512, 0.52], // inside the 80% safe zone
  ["public/apple-touch-icon.png", 180, 0.62],
];

for (const [path, size, coverage] of targets) {
  writeFileSync(path, drawIcon(size, coverage));
  console.log(`wrote ${path} (${size}px)`);
}
