# EPIC-019: Per-recipient watermarking

status: ready-for-qa
environment: dev
retries: 0

## Goal

When a document shared through EPIC-018 turns up somewhere it should not, the
copy names whoever opened it.

## What this is, and what it is not

A watermark **does not prevent a leak**. It makes one *traceable*. Anyone who
can read a document can photograph it, and no product changes that — DocSend
included. The UI says so next to the switch, because a customer who believes
otherwise will one day be very surprised.

## Design decisions

- **Stamped per request, never stored.** The mark carries the viewer's own
  identity, so a stored copy would eventually be served to the wrong person.
  There is therefore no cache to poison and no stale name in circulation.
- **Possible or not is decided when the link is created**, not when it is
  viewed. A switch that silently does nothing is worse than no switch — the
  sender is told immediately that a Word file has to be exported to PDF first.
- **A failed stamp returns an error, never the clean original.** A document
  that refuses to be marked (encrypted, malformed) must not quietly fall
  through: the sender asked for a traceable copy and would never learn they
  did not get one.
- **Word and Excel are out of scope** (Owner, 2026-08-10). Watermarking them
  needs LibreOffice in the container, hundreds of megabytes and a new failure
  domain, to serve a format that should be exported to PDF before it is
  circulated anyway.
- Two marks per page: a faint diagonal one across the middle, and a small one
  in the footer that survives a crop of the centre.

## Automation Log

- **2026-08-11 — Built and verified.**
  - `watermark.ts` (10 tests): `watermarkDecision` accepts PDF and
    PNG/JPEG/WebP, tolerates `APPLICATION/PDF; charset=…`, refuses anything
    over 25 MB *with the size in the message*, and points Office files at the
    PDF route. `watermarkText` renders the viewer, the organisation and the
    moment in WIB, and still marks an unattributed copy ("Shared link") when
    the link asks for no email — proving a leak came through a share rather
    than from inside. `escapeXml` exists because the viewer's own email is
    interpolated into an SVG overlay.
  - **Size is capped at link creation**, so "load it into memory to stamp it"
    is a bounded promise rather than a hope. A watermarked response cannot be
    streamed or range-served — the bytes do not exist until stamped and their
    length differs from the stored file — so range handling is skipped for
    those responses only.
  - Verified end to end on the running app: one file, two links. The
    watermarked link returned 1789 bytes containing `investor@fund.test`; the
    plain link returned the original 1411 bytes with no email. The original
    text survived in both — checked by extracting the text back out of the
    served PDF, not by trusting the writer.
  - Gates: lint ✅ typecheck ✅ 371 tests ✅ build ✅ security ✅.
