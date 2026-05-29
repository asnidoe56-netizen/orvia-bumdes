import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumb?: string;
  action?: ReactNode;
};

export function PageHeader({
  title,
  description,
  breadcrumb,
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-5 flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
      <div className="min-w-0">
        {breadcrumb ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {breadcrumb}
          </p>
        ) : null}

        <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>

        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="w-full shrink-0 sm:w-auto sm:text-right">{action}</div>
      ) : null}
    </div>
  );
}
