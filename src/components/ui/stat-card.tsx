import { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string;
  description?: string;
  icon?: ReactNode;
};

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </h3>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>

        {icon ? (
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            {icon}
          </div>
        ) : null}
      </div>
    </section>
  );
}
