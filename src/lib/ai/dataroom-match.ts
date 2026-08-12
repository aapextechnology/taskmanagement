// Which dataroom files a question is actually asking for (EPIC: AI×dataroom,
// Owner 2026-08-12). Pure and deliberately conservative: the match decides
// which documents get read, logged against the asker, and billed as tokens —
// a false positive reads a file nobody asked about and writes a phantom
// entry into the access audit.
//
// The rule: the FILE NAME must appear in the question (case-insensitive,
// extension optional) — never the other way around, so a question like
// "list my files" cannot match a file named "list.pdf".

export interface MatchableFile {
  fileId: string;
  name: string;
}

/** Most files one question may pull in; keeps cost and the audit honest. */
export const MAX_MATCHED_FILES = 2;

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function stem(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function matchRequestedFiles<T extends MatchableFile>(
  question: string,
  files: readonly T[],
): T[] {
  const q = normalise(question);
  if (q.length < 3) return [];

  const hits: T[] = [];
  for (const file of files) {
    const full = normalise(file.name);
    const base = normalise(stem(file.name));
    // short stems ("a", "doc") would match half of every sentence
    const candidate =
      full.length >= 5 && q.includes(full)
        ? full
        : base.length >= 5 && q.includes(base)
          ? base
          : null;
    if (candidate) hits.push(file);
  }
  // longest names first: "settlement final.pdf" beats "final.pdf" when both
  // appear, and the cap keeps one question from dragging in a whole folder
  hits.sort((a, b) => b.name.length - a.name.length);
  return hits.slice(0, MAX_MATCHED_FILES);
}
