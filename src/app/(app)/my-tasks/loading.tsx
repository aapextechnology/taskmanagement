// Skeleton for the "Your work" profile (package B).
export default function MyTasksLoading() {
  return (
    <section className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-44 rounded-md bg-muted" />
      <div className="h-9 w-full max-w-md rounded-md bg-muted/60" />
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-md bg-muted/60" />
            ))}
          </div>
          <div className="h-24 rounded-md bg-muted/50" />
          <div className="h-48 rounded-md bg-muted/40" />
        </div>
        <div className="h-64 w-full rounded-md bg-muted/50 lg:w-72" />
      </div>
    </section>
  );
}
