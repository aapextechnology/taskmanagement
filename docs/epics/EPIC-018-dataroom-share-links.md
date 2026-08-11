# EPIC-018: Dataroom share links for people outside the system

status: ready-for-qa
environment: dev
retries: 0

## Goal

Send one document to a vendor, a client or an investor without giving them an
account — and still know who opened it, and be able to shut it off.

Builds directly on EPIC-017: the bytes, the quota and the access log already
exist; this adds a second, tightly-bounded door into them.

## The rule this epic exists to honour

**Never a Nextcloud-style public link.** A link that works forever for whoever
holds it is exactly what the dataroom was built to avoid: forwarded into a
group chat once, it is open to everyone, permanently and invisibly. Every
link here is therefore:

- **time-limited** — an expiry is required, never optional. A link with no end
  date is the failure mode wearing a different hat.
- **revocable** — one click kills it, even before expiry.
- **attributable** — the viewer identifies themselves before the file opens,
  and every open lands in the same access log as internal reads.
- **narrow** — one link opens one file. Not a folder, not a room.

## Design decisions

- **The token is stored hashed** (sha256, matching `src/lib/external/service.ts`),
  so a database leak yields no working links. The plaintext exists only in the
  URL handed to the creator, once.
- **A passcode, when set, is hashed with scrypt** through the existing
  `hashPassword`. It is a second factor for the link, not a password for an
  account.
- **The email gate records, it does not authenticate.** Asking a visitor for
  their email proves nothing on its own; it is there so the audit trail names
  someone, and so an allowlist can refuse an address that was never invited.
  The UI must not imply more than that.
- **"Disable download" is friction, not prevention.** It withholds the button
  and serves the file inline; anyone who can see a document can photograph it.
  Saying so plainly is part of the feature — a customer who believes otherwise
  will one day be very surprised.
- **Every check runs on every request** — expiry, revocation, passcode, the
  allowlist. Nothing is trusted from a cookie set at the first visit.
- Revoking a link never deletes the log entries it produced. Who read a
  contract must outlive the link that let them.

## Tasks

- **T-180** Schema + service: `dataroom_share_links`, hashed tokens, required
  expiry, passcode, email gate and allowlist, revocation; access-log columns
  for an external viewer. Verification as a pure, unit-tested function.
- **T-181** The public `/share/[token]` route: gate, viewer identification,
  inline preview or download, all streamed through the same storage module.
- **T-182** Share management in the dataroom: create a link, copy it once,
  see opens per link, revoke.

## Acceptance Criteria

- An expired, revoked, or wrong-passcode link reveals nothing about the file —
  not its name, not that it exists.
- A link cannot be created without an expiry.
- Every open by an outsider appears in the event's activity with the email
  they gave.
- The plaintext token is never stored and never logged.
- An allowlisted link refuses an address that is not on the list.
- Revoking takes effect on the next request, with no cached bypass.

## Automation Log

- **Fix — a passcode-protected link could never be opened** (2026-08-11,
  reported by the Owner during QA). Filling in the email produced "Enter your
  email address" again, forever.
  - **Cause: the gate revealed one requirement at a time.** The passcode is
    checked before the email, so the first refusal said "passcode" and the
    form rendered only that box. Supplying the passcode moved the refusal on
    to "email", which rendered only the email box — dropping the passcode
    field — so the next submission failed the passcode again. The visitor
    ping-ponged between two screens that each threw away the other's answer.
    Reproduced before touching anything: supplying both values at once opened
    the document, which proved the verification logic was sound and the
    disclosure protocol was not.
  - **Fix:** once a link is confirmed live it reports *every* requirement at
    once (`gateRequirements`), so both boxes appear together. A dead link
    still reports nothing — it reveals neither its existence nor its shape,
    which the tests pin down.
  - Second fault found while fixing the first: a first-time visitor was told
    "That passcode is not right" before typing anything. A refusal now
    distinguishes "protected, please enter it" from "that was wrong".
  - The email box also keeps what was typed across a failed attempt. Retyping
    an address because the passcode was wrong is how people give up.
  - Verified live: first visit asks for both; a wrong passcode keeps both
    boxes and the typed email; the right pair opens the document; a revoked
    link still answers with the generic message and asks for nothing.

- **T-180 / T-181 / T-182 — Links, the public page, and share management**
  (2026-08-11). Shipped together; verified as an outsider with no account and
  no session.
  - **A passcode-protected link could never open the file.** The gate accepted
    the passcode and issued the pass, but the pass carried only the email —
    so every request for the bytes re-ran the passcode check with nothing to
    check against and failed forever. The whole feature was broken for any
    link with a passcode. The signed pass now carries a `passcodeOk` flag
    (inside the signature, so it cannot be forged), while expiry, revocation
    and the allowlist are still re-read from the database on every request.
    Found by testing the bytes, not the form.
  - `share-rules.ts` (16 tests) — every refusal path. The rule the tests
    exist to protect: **missing, expired and revoked links are
    indistinguishable**, and existence is checked before the passcode, so a
    wrong passcode on a dead link cannot be told apart from one on a live
    link. Confirmed live: the JSON returned for a revoked link is byte-for-
    byte the one returned for a token that never existed.
  - **The token is stored only as a sha256 hash.** Proven by scanning every
    stored row for the plaintext after creating a link: not present. The
    plaintext is shown once, in the dialog, and never again.
  - An expiry is required and bounded to 1–365 days. There is no "never
    expires" option, because that is the public-link failure mode this epic
    exists to avoid.
  - Live results: the file streams only after the gate (404 without a pass);
    a pass minted for one link returns 404 on another; an allowlisted link
    refuses a different address; download returns 403 when the link is
    view-only; and outside opens land in the same access log as internal
    reads, attributed to the email the visitor gave.
  - **"Disable download" is stated as friction, not prevention** — in the UI,
    next to the switch. Anyone who can read a document can photograph it.
  - Gates: lint ✅ typecheck ✅ 361 tests ✅ build ✅ security ✅. Test data
    removed afterwards.
