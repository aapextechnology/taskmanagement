// Skeleton for the approvals queue (package B).
export default function ApprovalsLoading() {
  return (
    <section className="flex animate-pulse flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-4 w-72 rounded-md bg-muted/70" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 rounded-md bg-muted/40" />
      ))}
    </section>
  );
}
