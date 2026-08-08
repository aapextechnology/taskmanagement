// Skeleton for the event workspace (package B).
export default function EventLoading() {
  return (
    <section className="flex animate-pulse flex-col gap-10">
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <div className="aspect-[3/4] w-full max-w-[240px] rounded-md bg-muted/60" />
        <div className="flex flex-1 flex-col gap-4">
          <div className="h-12 w-2/3 rounded-md bg-muted" />
          <div className="h-4 w-1/2 rounded-md bg-muted/70" />
          <div className="h-16 w-72 rounded-md bg-muted/50" />
          <div className="h-8 w-full rounded-md bg-muted/40" />
        </div>
      </div>
      <div className="h-48 rounded-md bg-muted/40" />
    </section>
  );
}
