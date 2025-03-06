import React, { useState } from "react";
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

  /** 
   * Eğer tablo içinden sıralama yönetmek istemiyorsanız, 
   * bu iki prop'u silebilirsiniz. 
   */
  enableSorting?: boolean;      // Sıralama açık/kapat
  defaultSortKey?: keyof T;     // Başlangıçta hangi alana göre sıralasın
  defaultSortDirection?: "asc" | "desc";
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
  enableSorting = false,
  defaultSortKey,
  defaultSortDirection = "asc",
}: TableProps<T, K>) {
  
  // İçeride sıralama mantığını tutmak için state
  const [sortKey, setSortKey] = useState<keyof T | undefined>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSortDirection);

  // Tüm veriyi sıralamak için basit bir yardımcı fonksiyon
  function sortData(dataToSort: T[]): T[] {
    if (!enableSorting || !sortKey) return dataToSort;
    let sorted = [...dataToSort];
    sorted.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      // Sayısal karşılaştırma
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      // String karşılaştırma
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  // Seçili veriyi sıralayalım
  const sortedData = sortData(data);

  // Sütun başlığına tıklandığında çalışır
  const handleHeaderClick = (columnKey: keyof T) => {
    if (!enableSorting) return;
    
    if (sortKey === columnKey) {
      // Aynı sütuna tıklandı -> yön değiştir
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // Farklı sütun -> sıralama bu sütunda asc başlasın
      setSortKey(columnKey);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    onSelectAll?.(checked);
  };

  const handleSelectRow = (item: T, checked: boolean) => {
    onSelect?.(item[idField] as K, checked);
  };

  if (loading) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!sortedData.length) {
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
            {columns.map((column) => {
              const isSorted = enableSorting && column.key === sortKey;
              return (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-sm font-semibold text-gray-900 ${
                    column.className || ""
                  } ${enableSorting ? "cursor-pointer select-none" : ""}`}
                  onClick={() => handleHeaderClick(column.key as keyof T)}
                >
                  <div className="inline-flex items-center gap-1">
                    {column.title}
                    {/* Eğer bu sütun sıralama sütunuysa yön simgesi göster */}
                    {isSorted && (
                      <span>
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedData.map((item, index) => (
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