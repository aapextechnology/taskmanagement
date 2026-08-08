import { Fragment } from "react";

// Socmed-style comment rendering: mentioned names ("@Name" / "@all") are
// bolded. Pure string splitting — no HTML injection surface.
export function CommentBody({
  body,
  mentionNames,
}: {
  body: string;
  mentionNames: string[];
}) {
  const tokens = [
    "@all",
    ...mentionNames.map((name) => `@${name}`),
  ].sort((a, b) => b.length - a.length);

  let parts: Array<{ text: string; bold: boolean }> = [{ text: body, bold: false }];
  for (const token of tokens) {
    parts = parts.flatMap((part) => {
      if (part.bold || !part.text.includes(token)) return [part];
      const pieces = part.text.split(token);
      const result: Array<{ text: string; bold: boolean }> = [];
      pieces.forEach((piece, index) => {
        if (index > 0) result.push({ text: token, bold: true });
        if (piece) result.push({ text: piece, bold: false });
      });
      return result;
    });
  }

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part.bold ? (
            <strong className="font-semibold">{part.text}</strong>
          ) : (
            part.text
          )}
        </Fragment>
      ))}
    </p>
  );
}
