import { ReactNode } from "react";

type ResponsiveRecordListProps<T> = {
  items: T[];
  getKey: (item: T, index: number) => string | number;
  renderMobileCard: (item: T, index: number) => ReactNode;
  renderDesktopTable: () => ReactNode;
  emptyState?: ReactNode;
  mobileClassName?: string;
  desktopClassName?: string;
};

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ResponsiveRecordList<T>({
  items,
  getKey,
  renderMobileCard,
  renderDesktopTable,
  emptyState,
  mobileClassName,
  desktopClassName,
}: ResponsiveRecordListProps<T>) {
  return (
    <>
      <div className={joinClassNames("space-y-3 md:hidden", mobileClassName)}>
        {items.length > 0
          ? items.map((item, index) => (
              <div key={getKey(item, index)}>
                {renderMobileCard(item, index)}
              </div>
            ))
          : emptyState}
      </div>

      <div className={joinClassNames("hidden md:block", desktopClassName)}>
        {renderDesktopTable()}
      </div>
    </>
  );
}
