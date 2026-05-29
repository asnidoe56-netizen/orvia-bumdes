import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <section
      className={[
        "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

type CardHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="break-words text-base font-bold text-slate-950">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0 sm:text-right">{action}</div> : null}
    </div>
  );
}
