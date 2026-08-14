import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertCan, type Actor } from "@/lib/permissions";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_SPECS,
  validateTemplate,
  type WaTemplateKey,
} from "./templates";

// Persistence for the editable WhatsApp templates (T-152). Bodies live in
// app_settings under `wa_template_<key>` — the same accessor pattern as
// branding and thresholds, so no new table or migration is needed.
//
// A missing row means "use the shipped default", which makes reset a DELETE
// and makes a fresh install work before anyone opens the editor.

const PREFIX = "wa_template_";

function settingKey(key: WaTemplateKey): string {
  return `${PREFIX}${key}`;
}

function asBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Every template body, custom where one was saved and default otherwise.
 * Never throws: a database problem must not stop a notification going out
 * with the default wording.
 */
export async function getWaTemplates(): Promise<Record<WaTemplateKey, string>> {
  const resolved = { ...DEFAULT_TEMPLATES };
  try {
    const rows = await db
      .select()
      .from(appSettings)
      .where(
        inArray(
          appSettings.key,
          TEMPLATE_SPECS.map((s) => settingKey(s.key)),
        ),
      );
    for (const row of rows) {
      const key = row.key.slice(PREFIX.length) as WaTemplateKey;
      const body = asBody(row.value);
      // a stored body that no longer validates (e.g. placeholders changed in
      // a later release) is ignored in favour of the default
      if (body && validateTemplate(key, body).ok) resolved[key] = body;
    }
  } catch (error) {
    console.error("[wa-templates] read failed, using defaults:", error);
  }
  return resolved;
}

export async function getWaTemplate(key: WaTemplateKey): Promise<string> {
  return (await getWaTemplates())[key];
}

export interface EditableTemplate {
  key: WaTemplateKey;
  body: string;
  /** false when the shipped default is in use */
  isCustom: boolean;
}

/** Editor view: the body plus whether it has been customised. */
export async function listEditableTemplates(): Promise<EditableTemplate[]> {
  const bodies = await getWaTemplates();
  return TEMPLATE_SPECS.map((spec) => ({
    key: spec.key,
    body: bodies[spec.key],
    isCustom: bodies[spec.key] !== DEFAULT_TEMPLATES[spec.key],
  }));
}

export async function updateWaTemplate(
  actor: Actor,
  key: WaTemplateKey,
  body: string,
): Promise<void> {
  assertCan(actor, "org.manage");
  if (!TEMPLATE_SPECS.some((s) => s.key === key)) {
    throw new Error("Unknown template.");
  }
  const verdict = validateTemplate(key, body);
  if (!verdict.ok) throw new Error(verdict.error);

  const value = body.trim();
  await db
    .insert(appSettings)
    .values({ key: settingKey(key), value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
  await logActivity({
    actorId: actor.id,
    action: "org.wa_template_update",
    entity: `whatsapp:template:${key}`,
    detail: { length: value.length },
  });
}

/** Drops the custom body so the shipped default applies again. */
export async function resetWaTemplate(
  actor: Actor,
  key: WaTemplateKey,
): Promise<void> {
  assertCan(actor, "org.manage");
  await db
    .insert(appSettings)
    .values({ key: settingKey(key), value: "" })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: "", updatedAt: new Date() },
    });
  await logActivity({
    actorId: actor.id,
    action: "org.wa_template_reset",
    entity: `whatsapp:template:${key}`,
    detail: {},
  });
}
