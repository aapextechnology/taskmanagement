import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { assertCan, type Actor } from "@/lib/permissions";
import { saveFileUpload } from "@/lib/uploads";
import { DOCUMENT_CATEGORIES, visibleDocuments, type DocumentCategory } from "./logic";

// Document library service (EPIC-008 T-082). Every read/write resolves the
// target division and goes through the central permission module.

export interface CreateDocumentInput {
  eventId: string;
  divisionId: string;
  category: string;
  title: string;
  file: File;
}

export async function listEventDocuments(actor: Actor, eventId: string) {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.eventId, eventId))
    .orderBy(desc(documents.createdAt));
  return visibleDocuments(actor, rows);
}

export async function createDocument(actor: Actor, input: CreateDocumentInput) {
  assertCan(actor, "document.manage", { divisionId: input.divisionId });

  if (!DOCUMENT_CATEGORIES.includes(input.category as DocumentCategory)) {
    throw new Error("Unknown document category.");
  }
  const title = input.title.trim();
  if (!title) {
    throw new Error("A title is required.");
  }

  const filePath = await saveFileUpload(input.file, "documents");

  const [row] = await db
    .insert(documents)
    .values({
      eventId: input.eventId,
      divisionId: input.divisionId,
      category: input.category as DocumentCategory,
      title,
      filePath,
      fileName: input.file.name,
      sizeBytes: input.file.size,
      uploadedBy: actor.id,
    })
    .returning();
  return row;
}
