import React, { useState, useMemo, useRef } from "react";
import { Column, TableId } from "../../types/table";

interface TableProps<
  T extends { [key: string]: any },
  K extends TableId = TableId
> {
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
  enableSorting?: boolean;
  defaultSortKey?: keyof T;
  defaultSortDirection?: "asc" | "desc";
  showTotals?: boolean;
  totalColumns?: Partial<Record<keyof T, "sum" | "count" | "inventory_value">>;
  totalData?: T[];
  // Yeni eklenen alt bilgi desteği
  totalFooters?: Partial<Record<keyof T, (data: T[]) => React.ReactNode>>;
  // Yeni eklenen görüntüleme seçenekleri
  fontSize?: "sm" | "md" | "lg"; // Tablo yazı boyutu
  density?: "compact" | "normal" | "relaxed"; // Tablo yoğunluğu
  theme?: "light" | "striped"; // Tablo teması
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
  showTotals = false,
  totalColumns = {},
  totalData,
  totalFooters = {},
  // Yeni görüntüleme seçenekleri
  fontSize = "md",
  density = "normal",
  theme = "light",
}: TableProps<T, K>) {
  // Sütunların genişlik durumlarını izlemek için state
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>({});

  // Sıralama state'i
  const [sortKey, setSortKey] = useState<keyof T | undefined>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    defaultSortDirection
  );

  // Referanslar
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  // Stil sınıflarını hesaplama 
  const getStyleClasses = useMemo(() => {
    // Font boyutu sınıfları
    const fontSizeClasses = {
      sm: {
        header: "text-xs",
        cell: "text-xs",
        totals: "text-xs"
      },
      md: {
        header: "text-sm",
        cell: "text-sm",
        totals: "text-sm"
      },
      lg: {
        header: "text-base",
        cell: "text-base",
        totals: "text-base"
      }
    };

    // Yoğunluk (padding) sınıfları
    const densityClasses = {
      compact: {
        headerPadding: "px-3 py-1", 
        cellPadding: "px-3 py-1"
      },
      normal: {
        headerPadding: "px-4 py-2",
        cellPadding: "px-4 py-2" 
      },
      relaxed: {
        headerPadding: "px-6 py-3",
        cellPadding: "px-6 py-3"
      }
    };

    // Tema (arka plan) sınıfları
    const themeClasses = {
      light: {
        header: "bg-gray-50",
        row: "bg-white",
        altRow: "bg-white", // Aynı renk - alternatif satır yok
        totals: "bg-gray-100"
      },
      striped: {
        header: "bg-gray-100",
        row: "bg-white",
        altRow: "bg-gray-50", // Alternatif satır - gri tonlu
        totals: "bg-gray-200"
      }
    };

    return {
      font: fontSizeClasses[fontSize],
      padding: densityClasses[density],
      theme: themeClasses[theme]
    };
  }, [fontSize, density, theme]);
  
  // Veriyi sıralama fonksiyonu
  function sortData(dataToSort: T[]): T[] {
    if (!enableSorting || !sortKey) return dataToSort;

    return [...dataToSort].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // Sayısal karşılaştırma
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      // String karşılaştırma
      const aStr = String(aVal || "").toLowerCase();
      const bStr = String(bVal || "").toLowerCase();
      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Sıralanmış veri
  const sortedData = sortData(data);

  // Toplam hesaplama - iyileştirilmiş ve envanter değeri desteği eklendi
  const totals = useMemo(() => {
    if (!showTotals || !totalColumns || Object.keys(totalColumns).length === 0)
      return null;

    const dataForTotals = totalData || data;
    const result = {} as Record<string, any>; // Daha esnek bir tip kullan

    // Toplamları hesapla
    Object.entries(totalColumns).forEach(([key, type]) => {
      const typedKey = key as keyof T;

      if (type === "sum") {
        const numericValues = dataForTotals
          .map((item) => item[typedKey])
          .filter((value) => typeof value === "number" && !isNaN(value));

        const sum = numericValues.reduce((sum, value) => sum + value, 0);
        result[key] = sum;
      }

      if (type === "count") {
        const count = dataForTotals.filter(
          (item) => item[typedKey] != null
        ).length;
        result[key] = count;
      }
      
      // Yeni: Envanter değeri hesaplama (fiyat * stok)
      if (type === "inventory_value") {
        const stockKey = "stock" as keyof T; // Stok kolonu adı
        
        const inventoryValue = dataForTotals.reduce((total, item) => {
          const price = Number(item[typedKey]) || 0;
          const stock = Number(item[stockKey]) || 0;
          return total + (price * stock);
        }, 0);
        
        result[key] = inventoryValue;
      }
    });

    return result;
  }, [totalData, data, showTotals, totalColumns]);

  // Sütun genişliğini değiştirmeye başlama işlevi
  const startColumnResize = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    resizingColumn.current = columnKey;
    startX.current = e.clientX;

    // Geçerli sütunun DOM elemanını bul
    const headerCell = e.currentTarget.closest("th");
    if (headerCell) {
      startWidth.current = headerCell.clientWidth;
    }

    // Fare hareket ve bırakma olaylarını dinle
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopColumnResize);
  };

  // Sütun genişliğini değiştirme işlevi
  const onMouseMove = (e: MouseEvent) => {
    if (!resizingColumn.current) return;

    const dx = e.clientX - startX.current;
    const newWidth = Math.max(50, startWidth.current + dx); // Minimum 50px genişlik

    setColumnWidths((prev) => ({
      ...prev,
      [resizingColumn.current!]: `${newWidth}px`,
    }));
  };

  // Sütun genişliğini değiştirmeyi durdurma işlevi
  const stopColumnResize = () => {
    resizingColumn.current = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", stopColumnResize);
  };

  // Çift tıklama ile sütunu içeriğe göre boyutlandırma
  const autoResizeColumn = (columnKey: string) => {
    if (!tableRef.current) return;

    // Sütun başlığı ve hücreleri bul
    const headerCells = tableRef.current.querySelectorAll("th");
    const headerCell = Array.from(headerCells).find(
      (cell) => cell.getAttribute("data-column-key") === columnKey
    );

    if (!headerCell) return;

    // İçeriği ölçmek için geçici bir span oluştur
    const tempSpan = document.createElement("span");
    tempSpan.style.visibility = "hidden";
    tempSpan.style.position = "absolute";
    tempSpan.style.whiteSpace = "nowrap";
    document.body.appendChild(tempSpan);

    // Başlığın genişliğini ölç
    tempSpan.textContent = headerCell.textContent || "";
    let maxWidth = tempSpan.offsetWidth + 40; // Padding için extra alan

    // Hücrelerin içeriğini ölç
    const bodyCells = tableRef.current.querySelectorAll(
      `td[data-column-key="${columnKey}"]`
    );
    bodyCells.forEach((cell) => {
      tempSpan.innerHTML = cell.innerHTML;
      const cellWidth = tempSpan.offsetWidth + 40; // Padding için extra alan
      maxWidth = Math.max(maxWidth, cellWidth);
    });

    // Temizleme
    document.body.removeChild(tempSpan);

    // Yeni genişliği ayarla
    setColumnWidths((prev) => ({
      ...prev,
      [columnKey]: `${maxWidth}px`,
    }));
  };

  // Sütun başlığına tıklandığında sıralama değiştirme
  const handleHeaderClick = (columnKey: keyof T, e: React.MouseEvent) => {
    // Çift tıklama kontrolü
    if (e.detail === 2) {
      autoResizeColumn(columnKey as string);
      return;
    }

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

  // Tüm öğeleri seçme
  const handleSelectAll = (checked: boolean) => {
    onSelectAll?.(checked);
  };

  // Tek öğe seçme
  const handleSelectRow = (item: T, checked: boolean) => {
    onSelect?.(item[idField] as K, checked);
  };

  // Metni kısaltma işlevi
  const truncateText = (text: string, maxLength = 30) => {
    if (!text || typeof text !== "string") return "";
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };

  // Yükleniyor durumu
  if (loading) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Veri yoksa
  if (!sortedData.length) {
    return (
      <div className={`w-full p-8 text-center ${getStyleClasses.font.cell} text-gray-500`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="overflow-auto border-gray-200 shadow-sm">
        <table 
          ref={tableRef} 
          className="w-full divide-y divide-gray-200"
        >
          <thead className={getStyleClasses.theme.header}>
            <tr>
              {selectable && (
                <th
                  className={`w-12 ${getStyleClasses.padding.headerPadding} text-left sticky left-0 ${getStyleClasses.theme.header} z-10`}
                  scope="col"
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </div>
                </th>
              )}

              {columns.map((column) => {
                const isSorted = enableSorting && column.key === sortKey;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    data-column-key={column.key}
                    className={`${getStyleClasses.padding.headerPadding} text-left ${getStyleClasses.font.header} font-medium tracking-wider text-gray-600 uppercase 
                      ${column.className || ""} 
                      ${enableSorting ? "cursor-pointer" : ""} 
                      relative group`}
                    style={{
                      width: columnWidths[column.key as string] || "auto",
                      minWidth: "50px",
                    }}
                    onClick={(e) => handleHeaderClick(column.key as keyof T, e)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.title}</span>
                      {enableSorting && (
                        <span className="inline-flex flex-col ml-1">
                          <svg
                            className={`w-2 h-2 ${
                              isSorted && sortDirection === "asc"
                                ? "text-indigo-600"
                                : "text-gray-400"
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                          </svg>
                          <svg
                            className={`w-2 h-2 ${
                              isSorted && sortDirection === "desc"
                                ? "text-indigo-600"
                                : "text-gray-400"
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Sütun yeniden boyutlandırma tutamağı */}
                    <div
                      className="absolute top-0 right-0 h-full w-2 cursor-col-resize opacity-0 group-hover:opacity-100 bg-indigo-500 bg-opacity-10 hover:bg-opacity-20"
                      onMouseDown={(e) =>
                        startColumnResize(e, column.key as string)
                      }
                      title="Sütunu yeniden boyutlandırmak için sürükleyin (çift tıklama otomatik boyutlandırır)"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {sortedData.map((item, index) => (
              <tr
                key={`row-${index}`}
                onClick={() => onRowClick?.(item)}
                className={`${
                  onRowClick ? "cursor-pointer hover:bg-gray-50" : ""
                } transition duration-150 ease-in-out ${
                  theme === 'striped' && index % 2 === 1 
                    ? getStyleClasses.theme.altRow 
                    : getStyleClasses.theme.row
                }`}
              >
                {selectable && (
                  <td className={`w-12 ${getStyleClasses.padding.cellPadding} sticky left-0 ${
                    theme === 'striped' && index % 2 === 1 
                      ? getStyleClasses.theme.altRow 
                      : getStyleClasses.theme.row
                  } whitespace-nowrap`}>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selected.includes(item[idField] as K)}
                        onChange={(e) =>
                          handleSelectRow(item, e.target.checked)
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </td>
                )}

                {columns.map((column) => {
                  let content = column.render
                    ? column.render(item)
                    : (item as any)[column.key];
                  // İçeriği JSX olarak render edildiyse truncate yapma
                  const isJSX = React.isValidElement(content);
                  const displayContent =
                    !isJSX && typeof content === "string"
                      ? truncateText(content)
                      : content;

                  return (
                    <td
                      key={`${index}-${column.key}`}
                      data-column-key={column.key}
                      className={`${getStyleClasses.padding.cellPadding} ${getStyleClasses.font.cell} ${
                        column.className || ""
                      } overflow-hidden text-ellipsis`}
                      style={{
                        width: columnWidths[column.key as string] || "auto",
                        maxWidth: columnWidths[column.key as string] || "300px",
                      }}
                      title={
                        !isJSX && typeof content === "string" ? content : ""
                      }
                    >
                      {displayContent}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Toplam satırı - Alt bilgi desteği ile */}
            {showTotals && totals && (
              <tr className={`${getStyleClasses.theme.totals} border-t-2 border-gray-300 font-medium text-gray-700`}>
                {selectable && (
                  <td className={`w-12 ${getStyleClasses.padding.cellPadding} sticky left-0 ${getStyleClasses.theme.totals} whitespace-nowrap font-bold ${getStyleClasses.font.totals}`}>
                    Toplam
                  </td>
                )}
                {columns.map((column, index) => {
                  const columnKey = column.key as keyof T;
                  const isTotal = totalColumns.hasOwnProperty(columnKey);
                  const totalValue = isTotal
                    ? totals[column.key as string]
                    : null;

                  // İlk sütun ve seçilebilir değilse "Toplam" başlığını burada göster
                  const isFirstColumn = index === 0 && !selectable;

                  // Alt bilgi varsa hesapla
                  const hasFooter = totalFooters.hasOwnProperty(columnKey);
                  const footerContent = hasFooter
                    ? totalFooters[columnKey]?.(totalData || data)
                    : null;

                  return (
                    <td
                      key={`total-${column.key}`}
                      data-column-key={column.key}
                      className={`${getStyleClasses.padding.cellPadding} ${
                        isTotal || isFirstColumn ? "font-bold" : ""
                      } ${column.className || ""} ${getStyleClasses.font.totals}`}
                      style={{
                        width: columnWidths[column.key as string] || "auto",
                        maxWidth: columnWidths[column.key as string] || "300px",
                      }}
                    >
                      <div className="flex flex-col">
                        {/* Ana toplam değeri */}
                        {isFirstColumn && (
                          <div className="font-bold">Toplam</div>
                        )}
                        
                        {isTotal && !isFirstColumn && (
                          <div>
                            {column.render ? (
                              column.render({
                                [column.key]: totalValue,
                              } as unknown as T)
                            ) : (
                              totalValue
                            )}
                          </div>
                        )}
                        
                        {/* Alt bilgi (footer) */}
                        {hasFooter && (
                          <div className="text-xs text-gray-500 mt-1">
                            {footerContent}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}