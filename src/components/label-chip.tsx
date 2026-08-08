import { labelColorKey, LABEL_COLORS } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

export function LabelChip({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  const hex = LABEL_COLORS[labelColorKey(color)].dot;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        className,
      )}
      style={{
        borderColor: `${hex}66`,
        backgroundColor: `${hex}1f`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: hex }}
      />
      {name}
    </span>
  );
}
