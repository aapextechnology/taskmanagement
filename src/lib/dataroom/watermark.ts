// Per-recipient watermarking (EPIC-019).
//
// What this is for, stated plainly because it is easy to oversell: a
// watermark does not stop a leak. It makes a leak *traceable* — when a
// document turns up somewhere it should not, the copy names whoever opened
// it. Anyone who can read a document can photograph it, and no product on
// the market changes that.
//
// The mark is burned into the bytes on the way out, per viewer, per request.
// Nothing is stored watermarked, so there is no cache to poison and no stale
// copy carrying the wrong name.

/** Above this we refuse rather than load a huge file into memory to stamp it. */
export const MAX_WATERMARK_BYTES = 25 * 1024 * 1024;

const PDF_TYPES = new Set(["application/pdf"]);
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export type WatermarkKind = "pdf" | "image";

export type WatermarkDecision =
  | { ok: true; kind: WatermarkKind }
  | { ok: false; reason: string };

/**
 * Whether a file can carry a watermark, decided from its type and size alone.
 * Called when the link is created, so the sender is told *before* they send
 * it — a switch that silently does nothing is worse than no switch.
 */
export function watermarkDecision(
  mimeType: string,
  sizeBytes: number,
): WatermarkDecision {
  const type = mimeType.split(";")[0].trim().toLowerCase();
  if (PDF_TYPES.has(type)) {
    if (sizeBytes > MAX_WATERMARK_BYTES) {
      return {
        ok: false,
        reason: `This PDF is larger than ${MAX_WATERMARK_BYTES / 1024 / 1024} MB, which is too big to stamp on every view.`,
      };
    }
    return { ok: true, kind: "pdf" };
  }
  if (IMAGE_TYPES.has(type)) {
    if (sizeBytes > MAX_WATERMARK_BYTES) {
      return { ok: false, reason: "This image is too large to watermark." };
    }
    return { ok: true, kind: "image" };
  }
  return {
    ok: false,
    reason:
      "Only PDFs and images can be watermarked. Export Word or Excel to PDF first.",
  };
}

export interface WatermarkContext {
  /** who is looking; falls back to a label when the link asks for no email */
  viewer: string | null;
  orgName: string;
  /** the moment of THIS request — passed in, never read here, so the text
   *  stays a pure function of its inputs and can be tested */
  at: Date;
}

/** The line stamped across every page. */
export function watermarkText(ctx: WatermarkContext): string {
  const stamp = ctx.at.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  const who = ctx.viewer?.trim() || "Shared link";
  return `${who} · ${ctx.orgName} · ${stamp} WIB`;
}

/** Stamps every page of a PDF, diagonally, behind the content. */
export async function watermarkPdf(
  bytes: Buffer,
  text: string,
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // Amber, not grey, and larger (Owner 2026-08-12): the first pass optimised
  // for the document staying pretty, and the Owner correctly optimised for
  // the mark being unmissable — a watermark nobody notices deters nobody.
  // Amber rather than pure yellow because #ff0-style yellow disappears into
  // white paper; amber stays legible on both white and dark pages.
  const AMBER = rgb(0.85, 0.62, 0.05);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    // sized to the page so a long email still fits on A4 and on a wide slide
    const size = Math.max(
      16,
      Math.min(width, height) / Math.max(16, text.length * 0.55),
    );
    const textWidth = font.widthOfTextAtSize(text, size);

    page.drawText(text, {
      x: (width - textWidth * 0.71) / 2,
      y: height / 2 - textWidth * 0.35,
      size,
      font,
      color: AMBER,
      opacity: 0.4,
      rotate: degrees(45),
    });

    // a second mark in the footer survives a crop of the middle
    page.drawText(text, {
      x: 24,
      y: 16,
      size: 10,
      font,
      color: AMBER,
      opacity: 0.85,
    });
  }
  return Buffer.from(await pdf.save());
}

/** Stamps an image by compositing an SVG band over it. */
export async function watermarkImage(
  bytes: Buffer,
  text: string,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const image = sharp(bytes);
  const meta = await image.metadata();
  const width = meta.width ?? 800;
  const height = meta.height ?? 600;
  const fontSize = Math.max(14, Math.round(width / 30));

  // amber, same reasoning as the PDF: yellow-on-white vanishes, amber does not
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="50%" text-anchor="middle"
      transform="rotate(-30 ${width / 2} ${height / 2})"
      font-family="sans-serif" font-weight="bold" font-size="${fontSize * 2}"
      fill="#d99e0b" fill-opacity="0.45">${escapeXml(text)}</text>
    <text x="12" y="${height - 12}" font-family="sans-serif" font-weight="bold"
      font-size="${fontSize}" fill="#d99e0b" fill-opacity="0.85">${escapeXml(text)}</text>
  </svg>`;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toBuffer();
}

/** The viewer's own email goes into an SVG — unescaped, it would break the
 *  overlay or inject markup into it. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
