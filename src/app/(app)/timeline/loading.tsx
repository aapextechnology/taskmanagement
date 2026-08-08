// Skeleton for the timeline feed (package B).
export default function TimelineLoading() {
  return (
    <section className="flex animate-pulse flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-4 w-64 rounded-md bg-muted/70" />
      </div>
      <div className="h-9 w-56 rounded-md bg-muted/50" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 rounded-md bg-muted/40" />
      ))}
    </section>
  );
}
