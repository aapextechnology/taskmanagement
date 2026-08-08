// Skeleton for the task list (package B).
export default function ListLoading() {
  return (
    <section className="flex animate-pulse flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-6 w-40 rounded-md bg-muted" />
        <div className="h-9 w-28 rounded-md bg-muted/70" />
      </div>
      <div className="h-9 w-full rounded-md bg-muted/50" />
      {[0, 1, 2].map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <div className="h-4 w-32 rounded-md bg-muted" />
          <div className="h-32 rounded-md bg-muted/40" />
        </div>
      ))}
    </section>
  );
}
