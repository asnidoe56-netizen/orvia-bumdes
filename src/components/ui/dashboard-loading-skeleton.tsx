type DashboardLoadingSkeletonProps = {
  titleWidthClassName?: string;
  showStats?: boolean;
  statCount?: number;
  showPanel?: boolean;
};

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DashboardLoadingSkeleton({
  titleWidthClassName = "w-52",
  showStats = true,
  statCount = 3,
  showPanel = true,
}: DashboardLoadingSkeletonProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div
          className={joinClassNames(
            "h-5 animate-pulse rounded-xl bg-slate-200",
            titleWidthClassName
          )}
        />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-xl bg-slate-100" />
      </section>

      {showStats ? (
        <section className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: statCount }).map((_, index) => (
            <div
              key={index}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="h-4 w-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="mt-4 h-7 w-20 animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-3 h-3 w-32 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ))}
        </section>
      ) : null}

      {showPanel ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-56 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-4 space-y-3">
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
