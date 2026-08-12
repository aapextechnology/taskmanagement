import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Shared status/priority/avatar atoms (T-112). The ONLY place functional
// colors are mapped — every surface renders these, never raw colors.

export type StatusKey =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";

export type PriorityKey = "low" | "medium" | "high" | "urgent";

const STATUS_DOT: Record<StatusKey, string> = {
  backlog: "bg-status-backlog",
  todo: "bg-status-todo",
  in_progress: "bg-status-in-progress",
  in_review: "bg-status-in-review",
  blocked: "bg-status-blocked",
  done: "bg-status-done",
  cancelled: "bg-muted-foreground/40",
};

export const STATUS_TEXT: Record<StatusKey, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export function StatusDot({
  status,
  className,
}: {
  status: StatusKey;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 rounded-full", STATUS_DOT[status], className)}
    />
  );
}

export function StatusChip({ status }: { status: StatusKey }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <StatusDot status={status} />
      {STATUS_TEXT[status]}
    </span>
  );
}

const PRIORITY_META: Record<
  PriorityKey,
  { icon: typeof ChevronUp; className: string; label: string }
> = {
  urgent: { icon: ChevronsUp, className: "text-priority-urgent", label: "Urgent" },
  high: { icon: ChevronUp, className: "text-priority-high", label: "High" },
  medium: { icon: Minus, className: "text-priority-medium", label: "Medium" },
  low: { icon: ChevronDown, className: "text-priority-low", label: "Low" },
};

export function PriorityIcon({
  priority,
  className,
  withLabel = false,
}: {
  priority: PriorityKey;
  className?: string;
  withLabel?: boolean;
}) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span
      title={meta.label}
      className={cn("inline-flex items-center gap-1", meta.className, className)}
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
      {withLabel ? <span className="text-xs">{meta.label}</span> : null}
    </span>
  );
}

// deterministic per-person tint (design overhaul 2026-08-07): same person =
// same color everywhere, so boards can be scanned by face, not by reading.
// Tints ride the label palette dots at low alpha — works in both themes.
const AVATAR_TINTS = [
  "#94a3b8",
  "#60a5fa",
  "#4ade80",
  "#fbbf24",
  "#fb923c",
  "#f87171",
  "#a78bfa",
  "#f472b6",
] as const;

function avatarTint(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

export function UserAvatar({
  name,
  className,
  src,
}: {
  name: string;
  className?: string;
  /** avatar path relative to the uploads root; initials when absent */
  src?: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- auth-gated route, next/image can't optimize it
      <img
        src={`/api/files/${src}`}
        alt={name}
        className={cn(
          "inline-flex shrink-0 rounded-full object-cover",
          className,
        )}
      />
    );
  }
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tint = avatarTint(name);
  return (
    <span
      title={name}
      style={{
        backgroundColor: `color-mix(in oklch, ${tint} 22%, transparent)`,
        color: tint,
        borderColor: `color-mix(in oklch, ${tint} 45%, transparent)`,
      }}
      className={cn(
        "inline-flex size-5 shrink-0 select-none items-center justify-center rounded-full border text-[9px] font-semibold uppercase",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({
  users,
  max = 3,
  className,
}: {
  users: Array<{ id: string; name: string }>;
  max?: number;
  className?: string;
}) {
  if (users.length === 0) return null;
  return (
    <span className={cn("flex -space-x-1.5", className)}>
      {users.slice(0, max).map((user) => (
        <UserAvatar key={user.id} name={user.name} className="ring-2 ring-card" />
      ))}
      {users.length > max ? (
        <span className="inline-flex size-5 items-center justify-center rounded-full border bg-muted text-[9px] text-muted-foreground ring-2 ring-card">
          +{users.length - max}
        </span>
      ) : null}
    </span>
  );
}
