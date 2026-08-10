// Markdown → Tiptap/ProseMirror document (EPIC-016 T-163).
//
// The assistant answers in markdown; a page stores the editor's JSON. Pasting
// raw markdown into a page would leave "**bold**" on screen, so it is parsed
// here into real nodes.
//
// Pure and dependency-free on purpose: it runs in a server action, and a
// markdown library that needs a DOM (or an HTML round-trip) would drag jsdom
// into the server bundle for a job this small. Only the subset the assistant
// actually emits is supported — headings, lists, tables, quotes, code, rules
// and the inline marks — and anything unrecognised degrades to plain text
// rather than being dropped.

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

const BOLD = /\*\*([^*]+)\*\*/;
const ITALIC = /(?<![*\w])[*_]([^*_\n]+)[*_](?![*\w])/;
const CODE = /`([^`\n]+)`/;
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;

/**
 * Parses inline marks into text nodes. Applied recursively so nested marks
 * (a bold link, say) survive rather than one winning and the other vanishing.
 */
export function parseInline(text: string): TiptapNode[] {
  if (!text) return [];

  const candidates: Array<{
    index: number;
    length: number;
    inner: string;
    mark: { type: string; attrs?: Record<string, unknown> };
  }> = [];

  const push = (
    re: RegExp,
    mark: (m: RegExpExecArray) => { type: string; attrs?: Record<string, unknown> },
    innerOf: (m: RegExpExecArray) => string,
  ) => {
    const m = re.exec(text);
    if (m) {
      candidates.push({
        index: m.index,
        length: m[0].length,
        inner: innerOf(m),
        mark: mark(m),
      });
    }
  };

  push(CODE, () => ({ type: "code" }), (m) => m[1]);
  push(LINK, (m) => ({ type: "link", attrs: { href: m[2] } }), (m) => m[1]);
  push(BOLD, () => ({ type: "bold" }), (m) => m[1]);
  push(ITALIC, () => ({ type: "italic" }), (m) => m[1]);

  if (candidates.length === 0) return [{ type: "text", text }];

  // leftmost match wins, so marks are applied in the order they appear
  candidates.sort((a, b) => a.index - b.index);
  const hit = candidates[0];

  const before = text.slice(0, hit.index);
  const after = text.slice(hit.index + hit.length);

  const innerNodes =
    hit.mark.type === "code"
      ? [{ type: "text", text: hit.inner }]
      : parseInline(hit.inner);

  const marked = innerNodes.map((node) => ({
    ...node,
    marks: [...(node.marks ?? []), hit.mark],
  }));

  return [...parseInline(before), ...marked, ...parseInline(after)];
}

function paragraph(text: string): TiptapNode {
  const content = parseInline(text);
  // an empty paragraph must have no content array at all, or ProseMirror
  // rejects the document
  return content.length > 0
    ? { type: "paragraph", content }
    : { type: "paragraph" };
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(line) && line.includes("-");
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function cell(type: "tableHeader" | "tableCell", text: string): TiptapNode {
  return { type, attrs: { colspan: 1, rowspan: 1 }, content: [paragraph(text)] };
}

/** Converts an assistant answer into a Tiptap document. */
export function markdownToDoc(markdown: string): TiptapDoc {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block — taken verbatim, marks are not parsed inside
    const fence = /^\s*```(\w*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      content.push({
        type: "codeBlock",
        attrs: { language: fence[1] || null },
        content: body.length ? [{ type: "text", text: body.join("\n") }] : undefined,
      });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: parseInline(heading[2].trim()),
      });
      i++;
      continue;
    }

    // table: a header row followed by a |---|---| separator
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const header = splitRow(line);
      const rows: TiptapNode[] = [
        {
          type: "tableRow",
          content: header.map((text) => cell("tableHeader", text)),
        },
      ];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        const cells = splitRow(lines[i]);
        rows.push({
          type: "tableRow",
          // pad/trim so every row matches the header width, which
          // ProseMirror requires
          content: Array.from({ length: header.length }, (_, c) =>
            cell("tableCell", cells[c] ?? ""),
          ),
        });
        i++;
      }
      content.push({ type: "table", content: rows });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const items: TiptapNode[] = [];
      while (i < lines.length) {
        const m = isOrdered
          ? /^\s*\d+[.)]\s+(.*)$/.exec(lines[i])
          : /^\s*[-*+]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push({ type: "listItem", content: [paragraph(m[1].trim())] });
        i++;
      }
      content.push({
        type: isOrdered ? "orderedList" : "bulletList",
        ...(isOrdered ? { attrs: { start: 1 } } : {}),
        content: items,
      });
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      const body: string[] = [quote[1]];
      i++;
      while (i < lines.length) {
        const q = /^\s*>\s?(.*)$/.exec(lines[i]);
        if (!q) break;
        body.push(q[1]);
        i++;
      }
      content.push({
        type: "blockquote",
        content: [paragraph(body.join(" ").trim())],
      });
      continue;
    }

    content.push(paragraph(line.trim()));
    i++;
  }

  // a document with no content at all is invalid in ProseMirror
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

/** Appends one document's blocks to another, for "add to an existing page". */
export function appendDoc(existing: unknown, addition: TiptapDoc): TiptapDoc {
  const base =
    existing &&
    typeof existing === "object" &&
    (existing as TiptapDoc).type === "doc" &&
    Array.isArray((existing as TiptapDoc).content)
      ? (existing as TiptapDoc).content
      : [];
  // drop a trailing empty paragraph so appending does not stack blank lines
  const trimmed = [...base];
  while (
    trimmed.length > 0 &&
    trimmed[trimmed.length - 1].type === "paragraph" &&
    !trimmed[trimmed.length - 1].content?.length
  ) {
    trimmed.pop();
  }
  return { type: "doc", content: [...trimmed, ...addition.content] };
}

/**
 * A page title taken from the answer: any heading beats the first line, since
 * an answer often opens with "Here is the summary:" before the real title.
 */
export function titleFromMarkdown(markdown: string, fallback = "Untitled"): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line.trim());
    if (heading) return trimTitle(heading[1]);
  }
  for (const line of lines) {
    if (line.trim()) return trimTitle(line);
  }
  return fallback;
}

function trimTitle(raw: string): string {
  const clean = raw
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();
  return clean.length > 80 ? `${clean.slice(0, 77).trimEnd()}…` : clean || "Untitled";
}
