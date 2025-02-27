import React from "react";
import { Column, TableId } from "../../types/table";

interface TableProps<T extends { [key: string]: any }, K extends TableId = TableId> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  className?: string;
  selected?: K[];
  onSelect?: (id: K, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  allSelected?: boolean;
  idField?: keyof T;
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<
  T extends { [key: string]: any },
  K extends TableId = TableId
>({
  data,
  columns,
  onRowClick,
  className = "",
  selected = [],
  onSelect,
  onSelectAll,
  allSelected = false,
  idField = "id" as keyof T,
  selectable = false,
  loading = false,
  emptyMessage = "Veri bulunamadı.",
}: TableProps<T, K>) {
  const handleSelectAll = (checked: boolean) => {
    if (onSelectAll) {
      onSelectAll(checked);
    }
  };

  const handleSelectRow = (item: T, checked: boolean) => {
    if (onSelect) {
      onSelect(item[idField] as K, checked);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="w-full p-8 text-center text-gray-500">{emptyMessage}</div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left">
        <thead className="bg-gray-50">
          <tr>
            {selectable && (
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-6 py-4 text-sm font-semibold text-gray-900 ${
                  column.className || ""
                }`}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((item, index) => (
            <tr
              key={index}
              onClick={() => onRowClick?.(item)}
              className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                onRowClick ? 'cursor-pointer hover:bg-gray-100' : ''
              }`}
            >
              {selectable && (
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selected.includes(item[idField] as K)}
                    onChange={(e) => handleSelectRow(item, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
              )}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-6 py-4 ${column.className || ""}`}
                >
                  {column.render ? column.render(item) : (item as any)[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}