"use client";

import { Link2, Link2Off, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchTesseraOptionsAction,
  mapTesseraAction,
} from "./tessera-map-actions";

// Maps this event to its Tessera counterpart (Owner 2026-08-12). The list is
// fetched on demand, not at page load: it costs a call to an unofficial,
// rate-limited API, and most visits to the Tickets page are not here to
// change the mapping.

export function TesseraMap({
  eventId,
  mappedId,
}: {
  eventId: string;
  mappedId: string | null;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<Array<{ id: string; name: string }> | null>(null);
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const result = await fetchTesseraOptionsAction();
      if ("error" in result) toast.error(result.error);
      else setOptions(result.options);
    });

  const map = (tesseraEventId: string | null) =>
    startTransition(async () => {
      const result = await mapTesseraAction(eventId, tesseraEventId);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(tesseraEventId ? "Mapped — sales sync hourly." : "Unlinked.");
        setOptions(null);
        router.refresh();
      }
    });

  const shown = (options ?? []).filter((o) =>
    o.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium">
          Tessera:{" "}
          {mappedId ? (
            <span className="text-status-done">linked ({mappedId})</span>
          ) : (
            <span className="text-muted-foreground">not linked</span>
          )}
        </span>
        <span className="flex gap-2">
          {mappedId ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => map(null)}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Link2Off className="size-3.5" /> Unlink
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={pending} onClick={load} className="gap-1.5">
            {pending && options === null ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            {mappedId ? "Change link" : "Link a Tessera event"}
          </Button>
        </span>
      </div>

      {options !== null ? (
        options.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing readable came back — check the connection on the Admin page.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter events…"
              className="h-8 text-xs"
            />
            <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
              {shown.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={pending}
                  onClick={() => map(option.id)}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    option.id === mappedId && "bg-accent/50 font-medium",
                  )}
                >
                  {option.name}
                  <span className="ml-1.5 text-[10px] text-muted-foreground">{option.id}</span>
                </button>
              ))}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
