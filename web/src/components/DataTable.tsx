import { tw } from "../styles/utilities";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button, Empty } from "./ui";
import type { LabRecord } from "../lib/types";
export interface Column {
  key: string;
  label: string;
  render: (row: LabRecord) => ReactNode;
}
export function DataTable({
  columns,
  rows,
  onSelect,
}: {
  columns: Column[];
  rows: LabRecord[];
  onSelect: (row: LabRecord) => void;
}) {
  if (!rows.length) return <Empty />;
  return (
    <div className={tw("table-scroll")}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
            <th scope="col">
              <span className={tw("sr-only")}>Open record</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id}>
              {columns.map((c) => (
                <td key={c.key}>{c.render(row)}</td>
              ))}
              <td>
                <Button
                  variant="ghost"
                  aria-label={`View ${row.number ?? row.name ?? "record"}`}
                  onClick={() => onSelect(row)}
                >
                  <ArrowUpRight size={17} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
