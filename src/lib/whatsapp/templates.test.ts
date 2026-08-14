import { describe, expect, it } from "vitest";
import {
  autoUrgentReason,
  DEFAULT_TEMPLATES,
  firstName,
  manualUrgentReason,
  MAX_TEMPLATE_LENGTH,
  PREVIEW_VARS,
  renderTemplate,
  TEMPLATE_SPECS,
  validateTemplate,
} from "./templates";

describe("renderTemplate", () => {
  it("substitutes every known placeholder", () => {
    const text = renderTemplate("Hi {name}, {task} for {event}: {url}", {
      name: "Budi",
      task: "Book the sound engineer",
      event: "Jakarta Fest",
      url: "https://example.test/t/1",
    });
    expect(text).toBe(
      "Hi Budi, Book the sound engineer for Jakarta Fest: https://example.test/t/1",
    );
  });

  it("repeats a placeholder used more than once", () => {
    expect(renderTemplate("{task} — {task}", { task: "X" })).toBe("X — X");
  });

  it("leaves an unsupplied placeholder visible rather than blanking it", () => {
    // a visible {reason} is a bug report; a silent hole is not
    expect(renderTemplate("Why: {reason}", {})).toBe("Why: {reason}");
  });

  it("does not touch braces that are not placeholders", () => {
    expect(renderTemplate("cost {50%} up", { task: "X" })).toBe("cost {50%} up");
  });
});

describe("validateTemplate", () => {
  it("accepts every shipped default", () => {
    for (const spec of TEMPLATE_SPECS) {
      expect(validateTemplate(spec.key, DEFAULT_TEMPLATES[spec.key])).toEqual({
        ok: true,
      });
    }
  });

  it("rejects an empty body", () => {
    const v = validateTemplate("task_urgent", "   ");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.error).toMatch(/cannot be empty/i);
  });

  it("rejects a body over the length limit", () => {
    const long = `{task} {url} ${"a".repeat(MAX_TEMPLATE_LENGTH)}`;
    const v = validateTemplate("task_urgent", long);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.error).toMatch(/too long/i);
  });

  it("names a misspelled placeholder instead of failing silently", () => {
    const v = validateTemplate("task_urgent", "{taks} {url}");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.error).toContain("{taks}");
  });

  it("rejects {reason} on templates that never receive one", () => {
    // only the urgent message has a reason to explain
    expect(validateTemplate("task_assigned_lead", "{task} {url} {reason}").ok).toBe(
      false,
    );
    expect(validateTemplate("task_urgent", "{task} {url} {reason}").ok).toBe(true);
  });

  it("insists on the placeholders that make a message actionable", () => {
    expect(validateTemplate("task_assigned_lead", "Hi {name}, check WhatsApp").ok).toBe(
      false,
    );
    expect(validateTemplate("task_assigned_lead", "{task} {url}").ok).toBe(true);
  });

  it("allows dropping the optional ones", () => {
    // an org may not want the greeting or the event name
    expect(validateTemplate("task_assigned_member", "New task: {task}\n{url}").ok).toBe(
      true,
    );
  });

  it("accepts a translated body", () => {
    const indonesian = "Halo {name}, kamu dapat tugas *{task}* di {event}.\nBuka: {url}";
    expect(validateTemplate("task_assigned_member", indonesian).ok).toBe(true);
  });
});

describe("firstName", () => {
  it("takes only the first word", () => {
    expect(firstName("Budi Santoso")).toBe("Budi");
  });

  it("keeps a single-word name", () => {
    expect(firstName("Sri")).toBe("Sri");
  });

  it("falls back to a neutral greeting when blank", () => {
    expect(firstName("   ")).toBe("there");
  });
});

describe("urgent reasons", () => {
  it("names the person who raised it by hand", () => {
    expect(manualUrgentReason("Andi")).toBe("raised to urgent by Andi");
  });

  it("stays readable when the actor name is missing", () => {
    expect(manualUrgentReason("  ")).toBe("raised to urgent");
  });

  it("singularises a lone waiter", () => {
    expect(autoUrgentReason({ waiters: 1, overdue: false })).toBe(
      "1 other task is waiting on it",
    );
  });

  it("pluralises and appends the overdue clause", () => {
    expect(autoUrgentReason({ waiters: 3, overdue: true })).toBe(
      "3 other tasks are waiting on it, and it is past its due date",
    );
  });
});

describe("preview", () => {
  it("leaves no placeholder unfilled in any default template", () => {
    // the editor's preview must never show a raw {token} on a stock install
    for (const spec of TEMPLATE_SPECS) {
      const preview = renderTemplate(DEFAULT_TEMPLATES[spec.key], PREVIEW_VARS);
      expect(preview).not.toMatch(/\{[a-zA-Z_]+\}/);
    }
  });
});
