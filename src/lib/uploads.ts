import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const FILE_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".zip",
]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Generic attachment upload (T-034): documents + images, 20 MB cap.
export async function saveFileUpload(
  file: File,
  subdir: "attachments" | "comments",
): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!FILE_EXTENSIONS.has(ext)) {
    throw new Error("Unsupported file type.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File exceeds the 20 MB limit.");
  }
  const relative = path.join(subdir, `${randomUUID()}${ext}`);
  const absolute = path.join(path.resolve(env.UPLOADS_DIR), relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  return relative;
}

// Store an uploaded image under UPLOADS_DIR/<subdir>/, return the relative
// path persisted on the record (served via /api/files/<relative-path>).
export async function saveImageUpload(
  file: File,
  subdir: "posters" | "comments",
): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error("Unsupported image type (jpg, png, webp only).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 5 MB limit.");
  }

  const relative = path.join(subdir, `${randomUUID()}${ext}`);
  const absolute = path.join(path.resolve(env.UPLOADS_DIR), relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  return relative;
}
