"use client";

import {
  Download,
  Folder,
  FolderPlus,
  Globe,
  Loader2,
  Lock,
  Share2,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allowedChildLevels, type Visibility } from "@/lib/dataroom/access";
import { cn } from "@/lib/utils";
import { createFolderAction, trashFileAction, type DataroomActionState } from "./actions";
import { ShareDialog } from "./share-dialog";

// EPIC-017 T-172. Uploads go straight to the API as a raw body so a large
// file is never held in memory — see the route for why multipart was avoided.

export interface FolderView {
  id: string;
  name: string;
  parentId: string | null;
  visibility: Visibility;
  divisionId: string | null;
  canUpload: boolean;
  canManage: boolean;
}

interface FileView {
  id: string;
  name: string;
  currentVersion: number;
  updatedAt: string;
}

const LEVEL_ICON: Record<Visibility, React.ReactNode> = {
  sealed: <Lock className="size-3.5" />,
  division: <Users className="size-3.5" />,
  event: <Folder className="size-3.5" />,
  organisation: <Globe className="size-3.5" />,
};

const LEVEL_LABEL: Record<Visibility, string> = {
  sealed: "Sealed — named people only",
  division: "One division",
  event: "Anyone on this event",
  organisation: "Everyone internal",
};

export function DataroomBrowser({
  eventId,
  folders,
  openFolderId,
  files,
  divisions,
}: {
  eventId: string;
  folders: FolderView[];
  openFolderId: string | null;
  files: FileView[];
  divisions: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const open = folders.find((f) => f.id === openFolderId) ?? null;
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [sharing, setSharing] = useState<FileView | null>(null);

  const parentLevel: Visibility = open?.visibility ?? "organisation";
  const levelOptions = allowedChildLevels(parentLevel).map((v) => ({
    value: v,
    label: v === "organisation" ? "Everyone" : v === "event" ? "Event" : v === "division" ? "Division" : "Sealed",
    icon: LEVEL_ICON[v],
    hint: LEVEL_LABEL[v],
  }));

  const [state, formAction, creating] = useActionState<DataroomActionState, FormData>(
    createFolderAction,
    {},
  );

  const upload = (file: File) => {
    if (!open) return;
    setUploading(file.name);
    setProgress(0);
    // XHR rather than fetch: it reports upload progress, which matters when a
    // rider or a video takes a minute to land
    const xhr = new XMLHttpRequest();
    const query = new URLSearchParams({ folderId: open.id, name: file.name });
    xhr.open("PUT", `/api/dataroom/upload?${query}`);
    xhr.setRequestHeader("x-file-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploading(null);
      const body = (() => {
        try {
          return JSON.parse(xhr.responseText) as { error?: string; crossedWarning?: boolean };
        } catch {
          return {};
        }
      })();
      if (xhr.status >= 400) {
        // quota and disk refusals arrive here already worded with the numbers
        toast.error(body.error ?? "Upload failed.");
        return;
      }
      toast.success(
        body.crossedWarning
          ? `${file.name} uploaded — this event has now passed 80% of its storage.`
          : `${file.name} uploaded.`,
      );
      router.refresh();
    };
    xhr.onerror = () => {
      setUploading(null);
      toast.error("Upload failed — the connection dropped.");
    };
    xhr.send(file);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* folders */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Folders
          </span>
          <button
            type="button"
            onClick={() => setNewFolder((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <FolderPlus className="size-3.5" /> New
          </button>
        </div>

        {folders.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            No folders yet. Create one to start filing documents for this event.
          </p>
        ) : (
          <nav className="flex flex-col gap-0.5">
            {folders.map((folder) => (
              <Link
                key={folder.id}
                href={`/events/${eventId}/dataroom?f=${folder.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  folder.id === openFolderId
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  folder.parentId && "ml-3",
                )}
                title={LEVEL_LABEL[folder.visibility]}
              >
                <span className="text-muted-foreground">{LEVEL_ICON[folder.visibility]}</span>
                <span className="truncate">{folder.name}</span>
              </Link>
            ))}
          </nav>
        )}

        {newFolder ? (
          <form action={formAction} className="flex flex-col gap-2.5 rounded-md border p-3">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="parentId" value={open?.id ?? ""} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dr-name" className="text-xs">
                Folder name
              </Label>
              <Input id="dr-name" name="name" required className="h-9 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Who can see it</Label>
              <Segmented name="visibility" options={levelOptions} defaultValue="event" />
              {open ? (
                <span className="text-[11px] text-muted-foreground">
                  Cannot be more open than “{open.name}”.
                </span>
              ) : null}
            </div>
            {divisions.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Division — only for a division folder</Label>
                <Segmented
                  name="divisionId"
                  options={divisions.map((d) => ({ value: d.id, label: d.name }))}
                  defaultValue={divisions[0]?.id}
                />
              </div>
            ) : null}
            {state.error ? (
              <p role="alert" className="text-xs text-destructive">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? "Creating…" : "Create folder"}
            </Button>
          </form>
        ) : null}
      </div>

      {/* files */}
      <div className="flex flex-col gap-3">
        {open ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                {LEVEL_ICON[open.visibility]} {open.name}
                <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {LEVEL_LABEL[open.visibility]}
                </span>
              </span>
              {open.canUpload ? (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const chosen = e.target.files?.[0];
                      if (chosen) upload(chosen);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={Boolean(uploading)}
                    onClick={() => fileInput.current?.click()}
                    className="gap-1.5"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    {uploading ? `${progress}%` : "Upload"}
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Read only</span>
              )}
            </div>

            {sharing ? (
              <ShareDialog
                eventId={eventId}
                fileId={sharing.id}
                fileName={sharing.name}
                onClose={() => setSharing(null)}
              />
            ) : null}

            {files.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nothing filed here yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-medium">File</th>
                      <th className="px-4 py-3 font-medium">Version</th>
                      <th className="px-4 py-3 font-medium">Updated</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.id} className="border-b transition-colors last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2.5">{file.name}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          v{file.currentVersion}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {new Date(file.updatedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "Asia/Jakarta",
                          })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center justify-end gap-1">
                            <a
                              href={`/api/dataroom/files/${file.id}`}
                              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Download className="size-3.5" /> Download
                            </a>
                            {open.canUpload ? (
                              <button
                                type="button"
                                onClick={() => setSharing(file)}
                                title="Share outside the system"
                                className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Share2 className="size-3.5" /> Share
                              </button>
                            ) : null}
                            {open.canUpload ? (
                              <form action={trashFileAction}>
                                <input type="hidden" name="eventId" value={eventId} />
                                <input type="hidden" name="fileId" value={file.id} />
                                <button
                                  type="submit"
                                  aria-label={`Move ${file.name} to trash`}
                                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </form>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Select a folder, or create the first one.
          </p>
        )}
      </div>
    </div>
  );
}
