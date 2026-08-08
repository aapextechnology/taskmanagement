// Skeleton while the dashboard gathers its queries (package B).
export default function DashboardLoading() {
  return (
    <section className="flex animate-pulse flex-col gap-10">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="h-4 w-80 rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted/60" />
        ))}
      </div>
      <div className="h-40 rounded-md bg-muted/50" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="h-56 rounded-md bg-muted/40" />
        <div className="h-56 rounded-md bg-muted/40" />
      </div>
    </section>
  );
}
