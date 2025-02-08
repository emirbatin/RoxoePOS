// types/table.ts
import React from 'react';

export interface Column<T> {
  key: string;
  title: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

// Generic bir ID type ekleyelim
export type TableId = string | number;

export interface TableProps<T, K extends TableId = TableId> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  className?: string;
  selected?: K[]; // Artık sadece string[] veya number[] değil, K[] olacak
  onSelect?: (ids: K[]) => void;
  idField?: keyof T; // any yerine T'nin keylerinden biri olmalı
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}