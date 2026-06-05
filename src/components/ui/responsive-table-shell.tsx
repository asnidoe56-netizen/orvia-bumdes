import { ReactNode } from "react";

type ResponsiveTableShellProps = {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
};

export function ResponsiveTableShell({
  children,
  className = "",
  scrollClassName = "",
}: ResponsiveTableShellProps) {
  return (
    <div
      className={[
        "min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "w-full max-w-full overflow-x-auto overscroll-x-contain",
          scrollClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
