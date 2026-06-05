import { ReactNode } from "react";
import { ResponsiveTableShell } from "@/components/ui/responsive-table-shell";

type DataTableProps = {
  columns: string[];
  children?: ReactNode;
  emptyText?: string;
  minWidthClassName?: string;
};

export function DataTable({
  children,
  columns,
  emptyText = "Belum ada data.",
  minWidthClassName = "min-w-[720px]",
}: DataTableProps) {
  const hasRows = Boolean(children);

  return (
    <ResponsiveTableShell>
      <table
        className={[
          "w-full border-separate border-spacing-0 text-left text-sm",
          minWidthClassName,
        ].join(" ")}
      >
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-black">
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-sm text-slate-500"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ResponsiveTableShell>
  );
}
