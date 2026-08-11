import type { ReactNode } from "react";
import { OpsDataTable } from "@/components/ui/ops-data-table";

type DataTableProps = {
  columns: string[];
  children: ReactNode;
  columnTemplate?: string;
  minWidth?: string;
};

export function DataTable({ columns, children, columnTemplate, minWidth }: DataTableProps) {
  return <OpsDataTable columns={columns} columnTemplate={columnTemplate} minWidth={minWidth}>{children}</OpsDataTable>;
}
