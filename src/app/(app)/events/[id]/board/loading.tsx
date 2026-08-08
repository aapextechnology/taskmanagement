// Skeleton for the kanban board (package B).
export default function BoardLoading() {
  return (
    <section className="flex animate-pulse flex-col gap-6">
      <div className="h-6 w-64 rounded-md bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((col) => (
          <div key={col} className="flex flex-col gap-3">
            <div className="h-4 w-24 rounded-md bg-muted" />
            <div className="h-24 rounded-md bg-muted/60" />
            <div className="h-24 rounded-md bg-muted/50" />
          </div>
        ))}
      </div>
    </section>
  );
}
