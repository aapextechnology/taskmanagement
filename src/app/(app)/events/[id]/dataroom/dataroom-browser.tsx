"use client";

import {
  Download,
  File as FileIcon,
  Folder,
  FolderPlus,
  Globe,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ContextMenu, useContextMenu, type MenuItem } from "@/components/context-menu";
import { Button } from "@/components/ui/button";
import type { Visibility } from "@/lib/dataroom/access";
import { cn } from "@/lib/utils";
import { fileMenuAction } from "./actions";
import { NewFolderDialog } from "./new-folder-dialog";
import { ShareDialog } from "./share-dialog";

// A file manager, not a form (Owner 2026-08-11): right-click or the ⋮ button
// for actions, drag files in from the desktop to upload, drag a row onto a
// folder to move it. Right-click alone would strand tablets and keyboards,
// so every action is reachable both ways.

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
  sealed: <Lock className="size-4" />,
  division: <Users className="size-4" />,
  event: <Folder className="size-4" />,
  organisation: <Globe className="size-4" />,
};

const LEVEL_LABEL: Record<Visibility, string> = {
  sealed: "Sealed — named people only",
  division: "One division",
  event: "Anyone on this event",
  organisation: "Everyone internal",
};

/** Wider than the parent = the file becomes visible to more people. */
const WIDTH: Record<Visibility, number> = {
  sealed: 0,
  division: 1,
  event: 2,
  organisation: 3,
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
  const [dropTarget, setDropTarget] = useState<"pane" | string | null>(null);
  const [newFolderFor, setNewFolderFor] = useState<FolderView | null | undefined>(undefined);
  const [sharing, setSharing] = useState<FileView | null>(null);
  const [renaming, setRenaming] = useState<{ kind: "file" | "folder"; id: string; name: string } | null>(null);
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const dragged = useRef<FileView | null>(null);

  const fileMenu = useContextMenu<FileView>();
  const folderMenu = useContextMenu<FolderView>();

  const run = (form: Record<string, string>) => {
    const data = new FormData();
    data.set("eventId", eventId);
    for (const [k, v] of Object.entries(form)) data.set(k, v);
    startTransition(async () => {
      const result = await fileMenuAction({}, data);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  };

  const uploadOne = (file: File, folderId: string) =>
    new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      const query = new URLSearchParams({ folderId, name: file.name });
      xhr.open("PUT", `/api/dataroom/upload?${query}`);
      xhr.setRequestHeader("x-file-type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        const body = (() => {
          try {
            return JSON.parse(xhr.responseText) as { error?: string; crossedWarning?: boolean };
          } catch {
            return {};
          }
        })();
        if (xhr.status >= 400) toast.error(body.error ?? `${file.name} was refused.`);
        else if (body.crossedWarning)
          toast.warning(`${file.name} uploaded — this event has passed 80% of its storage.`);
        else toast.success(`${file.name} uploaded.`);
        resolve();
      };
      xhr.onerror = () => {
        toast.error(`${file.name} failed — the connection dropped.`);
        resolve();
      };
      xhr.send(file);
    });

  const uploadMany = async (list: FileList | File[], folderId: string) => {
    const chosen = Array.from(list);
    if (chosen.length === 0) return;
    for (const file of chosen) {
      setUploading(file.name);
      setProgress(0);
      await uploadOne(file, folderId);
    }
    setUploading(null);
    router.refresh();
  };

  const onDropFiles = (event: React.DragEvent, folderId: string) => {
    event.preventDefault();
    setDropTarget(null);
    if (event.dataTransfer.files?.length) void uploadMany(event.dataTransfer.files, folderId);
  };

  const dropRowOnFolder = (folder: FolderView) => {
    const file = dragged.current;
    dragged.current = null;
    setDropTarget(null);
    if (!file || !open || folder.id === open.id) return;
    if (WIDTH[folder.visibility] > WIDTH[open.visibility]) {
      // moving a document somewhere more open is allowed — anyone who can
      // read it could re-upload it anyway — but never silently
      const ok = window.confirm(
        `“${folder.name}” is more open than “${open.name}”. Moving ${file.name} there makes it visible to more people. Continue?`,
      );
      if (!ok) return;
    }
    run({ verb: "move-file", fileId: file.id, folderId: folder.id });
  };

  const fileItems = (file: FileView): MenuItem[] => [
    {
      label: "Download",
      icon: <Download className="size-3.5" />,
      // the menu entry downloads; clicking the name previews
      onSelect: () => window.open(`/api/dataroom/files/${file.id}`, "_blank"),
    },
    ...(open?.canUpload
      ? [
          {
            label: "Share outside…",
            icon: <Share2 className="size-3.5" />,
            onSelect: () => setSharing(file),
          },
          {
            label: "Rename…",
            icon: <Pencil className="size-3.5" />,
            onSelect: () => setRenaming({ kind: "file", id: file.id, name: file.name }),
          },
          {
            label: "Move to trash",
            icon: <Trash2 className="size-3.5" />,
            danger: true,
            onSelect: () => run({ verb: "trash-file", fileId: file.id }),
          },
        ]
      : []),
  ];

  const folderItems = (folder: FolderView): MenuItem[] => [
    {
      label: "New folder inside…",
      icon: <FolderPlus className="size-3.5" />,
      disabled: !folder.canUpload,
      onSelect: () => setNewFolderFor(folder),
    },
    ...(folder.canManage
      ? [
          {
            label: "Rename…",
            icon: <Pencil className="size-3.5" />,
            onSelect: () =>
              setRenaming({ kind: "folder", id: folder.id, name: folder.name }),
          },
          {
            label: "Delete folder",
            icon: <Trash2 className="size-3.5" />,
            danger: true,
            onSelect: () => run({ verb: "delete-folder", folderId: folder.id }),
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      {/* folder tree */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Folders
          </span>
          <button
            type="button"
            onClick={() => setNewFolderFor(null)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <FolderPlus className="size-3.5" /> New
          </button>
        </div>

        {folders.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            No folders yet. Create one to start filing documents.
          </p>
        ) : (
          <nav className="flex flex-col gap-0.5">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                title={LEVEL_LABEL[folder.visibility]}
                onClick={() =>
                  router.push(`/events/${eventId}/dataroom?f=${folder.id}`)
                }
                onContextMenu={(e) => folderMenu.openAt(e, folder)}
                onDragOver={(e) => {
                  if (!dragged.current && !e.dataTransfer.types.includes("Files")) return;
                  e.preventDefault();
                  setDropTarget(folder.id);
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  if (dragged.current) {
                    e.preventDefault();
                    dropRowOnFolder(folder);
                  } else {
                    onDropFiles(e, folder.id);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  folder.id === openFolderId
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  dropTarget === folder.id && "ring-2 ring-foreground/40",
                  folder.parentId && "ml-3",
                )}
              >
                <span className="shrink-0 text-muted-foreground">
                  {LEVEL_ICON[folder.visibility]}
                </span>
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* file pane */}
      <div
        onDragOver={(e) => {
          if (!open?.canUpload || dragged.current) return;
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDropTarget("pane");
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => open && onDropFiles(e, open.id)}
        className={cn(
          "flex min-h-[60svh] flex-col gap-3 rounded-lg border border-transparent p-1 transition-colors",
          dropTarget === "pane" && "border-dashed border-foreground/40 bg-accent/20",
        )}
      >
        {open ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
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
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) void uploadMany(e.target.files, open.id);
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

            {uploading ? (
              <p className="px-1 text-xs text-muted-foreground">
                Uploading {uploading} — {progress}%
              </p>
            ) : null}

            {sharing ? (
              <ShareDialog
                eventId={eventId}
                fileId={sharing.id}
                fileName={sharing.name}
                onClose={() => setSharing(null)}
              />
            ) : null}

            {files.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-10 text-center">
                <Upload className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {open.canUpload
                    ? "Drop files here, or use the Upload button."
                    : "Nothing filed here yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Version</th>
                      <th className="px-4 py-2.5 font-medium">Updated</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr
                        key={file.id}
                        draggable={open.canUpload}
                        onDragStart={() => {
                          dragged.current = file;
                        }}
                        onDragEnd={() => {
                          dragged.current = null;
                          setDropTarget(null);
                        }}
                        onContextMenu={(e) => fileMenu.openAt(e, file)}
                        onClick={() =>
                          window.open(
                            `/api/dataroom/files/${file.id}?inline=1`,
                            "_blank",
                          )
                        }
                        className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/30"
                      >
                        <td className="px-4 py-2.5">
                          {/* A real link, not a click handler: opening a file
                              is navigation, so middle-click and ctrl-click
                              behave as people expect and the row becomes
                              reachable from the keyboard — previously nothing
                              here was focusable except the ⋮ button.
                              draggable={false} keeps the anchor from
                              hijacking the row's drag-to-move. */}
                          <a
                            href={`/api/dataroom/files/${file.id}?inline=1`}
                            target="_blank"
                            rel="noreferrer"
                            draggable={false}
                            // the row already opens the file; without this the
                            // anchor's own click would bubble and open it twice
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 underline-offset-4 hover:underline"
                          >
                            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                            {file.name}
                          </a>
                        </td>
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
                        <td className="px-2 py-2.5">
                          <button
                            type="button"
                            aria-label={`Actions for ${file.name}`}
                            onClick={(e) => {
                              // sits inside a clickable row — without this,
                              // opening the menu would also open the file
                              e.stopPropagation();
                              fileMenu.openNear(e.currentTarget, file);
                            }}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            Select a folder, or create the first one.
          </p>
        )}
      </div>

      <ContextMenu
        position={fileMenu.position}
        items={fileMenu.target ? fileItems(fileMenu.target) : []}
        onClose={fileMenu.close}
      />
      <ContextMenu
        position={folderMenu.position}
        items={folderMenu.target ? folderItems(folderMenu.target) : []}
        onClose={folderMenu.close}
      />

      <NewFolderDialog
        eventId={eventId}
        parent={newFolderFor ?? null}
        divisions={divisions}
        open={newFolderFor !== undefined}
        onOpenChange={(v) => setNewFolderFor(v ? null : undefined)}
      />

      {renaming ? (
        <RenameDialog
          current={renaming}
          onCancel={() => setRenaming(null)}
          onConfirm={(name) => {
            run(
              renaming.kind === "file"
                ? { verb: "rename-file", fileId: renaming.id, name }
                : { verb: "rename-folder", folderId: renaming.id, name },
            );
            setRenaming(null);
          }}
        />
      ) : null}
    </div>
  );
}

function RenameDialog({
  current,
  onCancel,
  onConfirm,
}: {
  current: { kind: "file" | "folder"; name: string };
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState(current.name);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onConfirm(value.trim());
        }}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border bg-card p-4 shadow-lg"
      >
        <h2 className="text-sm font-semibold">
          Rename {current.kind === "file" ? "file" : "folder"}
        </h2>
        <input
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!value.trim()}>
            Rename
          </Button>
        </div>
      </form>
    </div>
  );
}
