import type { ReactNode } from "react";
import { OpsDataTable } from "@/components/ui/ops-data-table";

type DataTableProps = {
  columns: string[];
  children: ReactNode;
};

export function DataTable({ columns, children }: DataTableProps) {
  return <OpsDataTable columns={columns}>{children}</OpsDataTable>;
}
