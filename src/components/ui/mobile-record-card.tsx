import { ReactNode } from "react";

type MobileRecordCardRow = {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};

type MobileRecordCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  rows?: MobileRecordCardRow[];
  footer?: ReactNode;
  className?: string;
};

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MobileRecordCard({
  title,
  subtitle,
  badge,
  rows = [],
  footer,
  className,
}: MobileRecordCardProps) {
  return (
    <article
      className={joinClassNames(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {subtitle ? (
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              {subtitle}
            </p>
          ) : null}

          <h3 className="mt-1 break-words text-base font-black text-slate-950">
            {title}
          </h3>
        </div>

        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {rows.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className={joinClassNames(
                "rounded-2xl bg-slate-50 p-3",
                row.fullWidth && "col-span-2"
              )}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {row.label}
              </p>
              <div className="mt-1 break-words font-semibold text-slate-800">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {footer ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">{footer}</div>
      ) : null}
    </article>
  );
}
