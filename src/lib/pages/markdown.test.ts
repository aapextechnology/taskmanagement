import { describe, expect, it } from "vitest";
import {
  appendDoc,
  markdownToDoc,
  parseInline,
  titleFromMarkdown,
} from "./markdown";

describe("parseInline", () => {
  it("marks bold, italic and code", () => {
    expect(parseInline("**b**")).toEqual([
      { type: "text", text: "b", marks: [{ type: "bold" }] },
    ]);
    expect(parseInline("*i*")[0].marks).toEqual([{ type: "italic" }]);
    expect(parseInline("`c`")[0].marks).toEqual([{ type: "code" }]);
  });

  it("keeps the surrounding plain text", () => {
    const nodes = parseInline("total **75jt** over");
    expect(nodes.map((n) => n.text)).toEqual(["total ", "75jt", " over"]);
    expect(nodes[0].marks).toBeUndefined();
  });

  it("nests marks instead of losing one", () => {
    const [node] = parseInline("**[RVC](https://x.test)**");
    expect(node.text).toBe("RVC");
    expect(node.marks).toEqual([
      { type: "link", attrs: { href: "https://x.test" } },
      { type: "bold" },
    ]);
  });

  it("does not treat code content as markdown", () => {
    expect(parseInline("`**not bold**`")[0].text).toBe("**not bold**");
  });

  it("leaves a bare underscore inside a word alone", () => {
    expect(parseInline("event_id stays")).toEqual([
      { type: "text", text: "event_id stays" },
    ]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseInline("")).toEqual([]);
  });
});

describe("markdownToDoc", () => {
  it("never produces an empty document", () => {
    expect(markdownToDoc("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("converts headings with their level", () => {
    const doc = markdownToDoc("### Ringkasan");
    expect(doc.content[0]).toMatchObject({
      type: "heading",
      attrs: { level: 3 },
    });
  });

  it("groups consecutive bullets into one list", () => {
    const doc = markdownToDoc("- a\n- b\n- c");
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("bulletList");
    expect(doc.content[0].content).toHaveLength(3);
  });

  it("distinguishes ordered from bulleted lists", () => {
    expect(markdownToDoc("1. a\n2. b").content[0].type).toBe("orderedList");
  });

  it("converts a table, padding short rows to the header width", () => {
    const doc = markdownToDoc(
      "| Item | Planned |\n| --- | --- |\n| Rigging | 45jt |\n| Sound |",
    );
    const table = doc.content[0];
    expect(table.type).toBe("table");
    expect(table.content).toHaveLength(3);
    expect(table.content?.[0].content?.[0].type).toBe("tableHeader");
    // the short row still has two cells, or ProseMirror would reject it
    expect(table.content?.[2].content).toHaveLength(2);
  });

  it("takes a code block verbatim", () => {
    const doc = markdownToDoc("```sql\nselect **1**\n```");
    expect(doc.content[0]).toMatchObject({
      type: "codeBlock",
      attrs: { language: "sql" },
    });
    expect(doc.content[0].content?.[0].text).toBe("select **1**");
  });

  it("merges a multi-line quote into one blockquote", () => {
    const doc = markdownToDoc("> one\n> two");
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("blockquote");
  });

  it("handles a realistic answer end to end", () => {
    const doc = markdownToDoc(
      "## Ringkasan\n\nTotal **over budget**.\n\n- Rigging: over\n- Sound: under\n\n---\n",
    );
    expect(doc.content.map((n) => n.type)).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "horizontalRule",
    ]);
  });
});

describe("appendDoc", () => {
  it("appends after existing blocks", () => {
    const existing = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "old" }] }] };
    const result = appendDoc(existing, markdownToDoc("new"));
    expect(result.content).toHaveLength(2);
    expect(result.content[0].content?.[0].text).toBe("old");
  });

  it("drops a trailing empty paragraph so blank lines do not stack", () => {
    const existing = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "old" }] },
        { type: "paragraph" },
      ],
    };
    expect(appendDoc(existing, markdownToDoc("new")).content).toHaveLength(2);
  });

  it("treats null or junk existing content as an empty page", () => {
    expect(appendDoc(null, markdownToDoc("x")).content).toHaveLength(1);
    expect(appendDoc("nonsense", markdownToDoc("x")).content).toHaveLength(1);
  });
});

describe("titleFromMarkdown", () => {
  it("prefers a heading over an opening line of preamble", () => {
    // answers often start "Here is the summary:" before the real title
    expect(titleFromMarkdown("Here is the summary:\n\n# Real title")).toBe(
      "Real title",
    );
    expect(titleFromMarkdown("# Real title\nbody")).toBe("Real title");
  });

  it("falls back to the first line when there is no heading", () => {
    expect(titleFromMarkdown("Budget looks fine\nmore text")).toBe(
      "Budget looks fine",
    );
  });

  it("strips markdown syntax from the title", () => {
    expect(titleFromMarkdown("## **Budget** `summary`")).toBe("Budget summary");
  });

  it("truncates a very long first line", () => {
    const title = titleFromMarkdown("x".repeat(200));
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back when there is nothing usable", () => {
    expect(titleFromMarkdown("   \n\n", "Chat summary")).toBe("Chat summary");
  });
});
