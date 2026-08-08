import { and, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  divisions,
  documents,
  events,
  profiles,
  tasks,
} from "@/db/schema";
import { visibleDocuments } from "@/lib/documents/logic";
import { can, type Actor } from "@/lib/permissions";
import { canSearch, visibleDivisionsFor } from "./scope";

// Global search (T-102). Every branch applies the SAME scoping the pages
// use: owner/admin see all divisions, members only theirs, externals
// nothing. A result here is always a record the user could open.

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchResults {
  events: SearchHit[];
  tasks: SearchHit[];
  documents: SearchHit[];
  people: SearchHit[];
}

const EMPTY: SearchResults = { events: [], tasks: [], documents: [], people: [] };

export async function globalSearch(
  actor: Actor,
  rawQuery: string,
): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (!canSearch(actor) || query.length < 2) return EMPTY;

  const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const scope = visibleDivisionsFor(actor);
  if (scope !== null && scope.length === 0) return EMPTY;

  const [eventHits, taskHits, documentHits, peopleHits] = await Promise.all([
    // events — any internal user browses events (event.view)
    db
      .select({ id: events.id, name: events.name, venue: events.venue, showDate: events.showDate })
      .from(events)
      .where(
        and(
          isNull(events.archivedAt),
          or(
            ilike(events.name, pattern),
            ilike(events.artists, pattern),
            ilike(events.venue, pattern),
          ),
        ),
      )
      .limit(5),

    // tasks — division-fenced exactly like the board/list pages
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        eventName: events.name,
        divisionName: divisions.name,
      })
      .from(tasks)
      .innerJoin(events, eq(tasks.eventId, events.id))
      .innerJoin(divisions, eq(tasks.divisionId, divisions.id))
      .where(
        and(
          ilike(tasks.title, pattern),
          ne(tasks.status, "cancelled"),
          ...(scope ? [inArray(tasks.divisionId, scope)] : []),
        ),
      )
      .limit(8),

    // documents — fetched broad, then filtered through the SAME helper the
    // library page uses (document.view per division)
    db
      .select({ document: documents, eventName: events.name })
      .from(documents)
      .innerJoin(events, eq(documents.eventId, events.id))
      .where(
        or(ilike(documents.title, pattern), ilike(documents.fileName, pattern)),
      )
      .limit(24),

    // people — names are internal-directory data; email only for admins
    db
      .select({ id: profiles.id, name: profiles.name, email: profiles.email, role: profiles.role })
      .from(profiles)
      .where(
        and(
          eq(profiles.isActive, true),
          ne(profiles.role, "external"),
          can(actor, "org.manage")
            ? or(ilike(profiles.name, pattern), ilike(profiles.email, pattern))
            : ilike(profiles.name, pattern),
        ),
      )
      .orderBy(sql`lower(${profiles.name})`)
      .limit(5),
  ]);

  const visibleDocs = visibleDocuments(
    actor,
    documentHits.map((d) => d.document),
  ).slice(0, 5);
  const eventNameByDoc = new Map(
    documentHits.map((d) => [d.document.id, d.eventName]),
  );

  return {
    events: eventHits.map((e) => ({
      id: e.id,
      title: e.name,
      subtitle: e.venue,
      href: `/events/${e.id}`,
    })),
    tasks: taskHits.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: `${t.eventName} · ${t.divisionName}`,
      href: `/tasks/${t.id}`,
    })),
    documents: visibleDocs.map((d) => ({
      id: d.id,
      title: d.title,
      subtitle: `${eventNameByDoc.get(d.id) ?? ""} · ${d.fileName}`,
      href: `/events/${d.eventId}/documents`,
    })),
    people: peopleHits.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: can(actor, "org.manage") ? `${p.email} · ${p.role}` : p.role,
      href: can(actor, "org.manage") ? "/admin" : "",
    })),
  };
}
