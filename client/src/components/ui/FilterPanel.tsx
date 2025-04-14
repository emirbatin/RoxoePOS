import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar,
  ChevronDown,
  FileText,
  XCircle,
  Filter,
  RefreshCw,
  Search,
  CheckCircle,
  Tag,
  DollarSign,
  CreditCard,
  Percent,
  X,
  CalendarRange,
  Loader2,
  Scan,
  Settings,
} from "lucide-react";

import {
  cleanTextForSearch,
  normalizedSearch,
} from "../../utils/turkishSearch";

const formatDateDisplay = (date: Date | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Düzeltilmiş Click outside hook - toggle butonunu hariç tutacak
const useClickOutside = (
  handler: () => void,
  excludeRef?: React.RefObject<HTMLElement>
) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Eğer tıklama popup dışında VE hariç tutulan buton dışında ise kapat
      const clickedOnExcludedElement = excludeRef?.current?.contains(
        event.target as Node
      );

      if (
        ref.current &&
        !ref.current.contains(event.target as Node) &&
        !clickedOnExcludedElement
      ) {
        handler();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handler, excludeRef]);

  return ref;
};

// Unified interface for all filter types
export interface FilterValue {
  [key: string]: any;
}

// Active filter display interface
export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
  onRemove?: () => void; // Added onRemove function
}

type FilterPanelMode = "sales" | "pos" | "basic";

interface FilterPanelProps {
  // Common props
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onReset: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  isLoading?: boolean;

  // Filter related props
  filter?: FilterValue;
  onFilterChange?: (filter: FilterValue) => void;
  activeFilters?: ActiveFilter[];
  onFilterRemove?: (key: string, value?: string) => void; // Değiştirildi: value parametresi eklendi

  // Visual configuration
  mode?: FilterPanelMode;
  searchPlaceholder?: string;

  // POS specific props
  onBarcodeDetected?: (barcode: string) => void;
  onScanModeChange?: (isScanning: boolean) => void;
  quantityModeActive?: boolean;
  inputId?: string;

  // Extra actions
  onRefresh?: () => void;

  // Custom filter panels
  filterPanelContent?: React.ReactNode;
  renderActiveFilters?: () => React.ReactNode; // Özel aktif filtre render fonksiyonu

  // Date helper functions (only used in sales mode)
  startOfDay?: (date: Date) => Date;
  endOfDay?: (date: Date) => Date;

  // POS mode specific props
  showFilter?: boolean;
  toggleFilter?: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  searchTerm,
  onSearchTermChange,
  filter = {},
  onFilterChange,
  onReset,
  isLoading = false,
  onRefresh,
  inputRef,

  // Mode configuration
  mode = "basic" as FilterPanelMode,
  searchPlaceholder,

  // Active filters
  activeFilters = [],
  onFilterRemove,

  // POS specific props
  onBarcodeDetected,
  onScanModeChange,
  quantityModeActive = false,
  inputId = "searchInput",

  // Custom filter panel
  filterPanelContent,
  renderActiveFilters,

  // Date helper functions
  startOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  },

  endOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
  },

  // POS mode specific props
  showFilter = false,
  toggleFilter,
}) => {
  // İç state değerini sadece mode !== 'pos' durumunda kullan
  const [internalShowFilter, setInternalShowFilter] = useState<boolean>(false);

  // POS modunda dışarıdan gelen showFilter değerini kullan, diğer modlarda iç state kullan
  const isFilterShown = mode === "pos" ? showFilter : internalShowFilter;

  // Toggle fonksiyonu aynı şekilde belirlenir
  const handleToggleFilter = () => {
    if (mode === "pos" && toggleFilter) {
      toggleFilter();
    } else {
      setInternalShowFilter((prev) => !prev);
    }
  };

  // Toggle butonu için ref
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  // ÖNEMLİ: tempFilter'ı doğrudan filtre üzerinden initialize et, ama güncellemeyi
  // useEffect içinde JSON.stringify karşılaştırmasıyla yap
  const [tempFilter, setTempFilter] = useState<FilterValue>(filter);

  // Barcode scanning for POS mode
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isProcessingBarcode, setIsProcessingBarcode] = useState(false);
  const lastKeyPressTime = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reference for click outside handler - toggle butonunu hariç tut
  const filterRef = useClickOutside(() => {
    if (mode === "pos" && toggleFilter) {
      if (showFilter) toggleFilter();
    } else {
      setInternalShowFilter(false);
    }
  }, toggleButtonRef);

  // useMemo ile hasActiveFilters'ı hesapla (her render'da hesaplanmasın diye)
  const hasActiveFilters = useMemo(() => {
    return (
      (mode === "sales" &&
        filter &&
        Object.keys(filter).length > 0 &&
        Object.values(filter).some(
          (value) => value !== undefined && value !== ""
        )) ||
      activeFilters.length > 0
    );
  }, [mode, filter, activeFilters]);

  // useMemo ile activeFilterCount'u hesapla
  const activeFilterCount = useMemo(() => {
    if (mode === "pos" || mode === "basic") {
      return activeFilters.length;
    }

    // For sales mode, calculate from filter object
    let count = 0;

    // Count dates as one filter
    if (filter?.startDate && filter?.endDate) {
      count++;
    }

    // Count other filters
    if (filter?.status) count++;
    if (filter?.paymentMethod) count++;
    if (filter?.hasDiscount !== undefined) count++;
    if (filter?.minAmount !== undefined || filter?.maxAmount !== undefined)
      count++;

    return count;
  }, [mode, filter, activeFilters]);

  // JSON.stringify ile derin karşılaştırma
  // filterin son değeriyle tempFilter'ı senkronize et, ancak sonsuz döngüye girme
  useEffect(() => {
    const currentFilterString = JSON.stringify(filter);
    const tempFilterString = JSON.stringify(tempFilter);

    if (currentFilterString !== tempFilterString) {
      setTempFilter(filter);
    }
  }, [filter]);

  // Barkod tarama modunu izleme fonksiyonu
  useEffect(() => {
    if (onScanModeChange && mode === "pos") {
      onScanModeChange(isProcessingBarcode);
    }
  }, [isProcessingBarcode, onScanModeChange, mode]);

  // Barkod tarama işlevselliği için etkileşimleri izleme
  useEffect(() => {
    if (mode !== "pos") return () => {}; // POS modunda değilse çalışmasın

    const handleKeyDown = (event: KeyboardEvent) => {
      // Yıldız modu aktifse hiçbir tuşu işleme
      if (quantityModeActive) {
        return;
      }

      // Yıldız tuşu için özel işlem
      if (event.key === "*") {
        if (document.activeElement === inputRef?.current) {
          return;
        }
        return;
      }

      // Diğer input alanlarında yazı yazılırken barkod taramayı devre dışı bırak
      if (
        document.activeElement &&
        document.activeElement.matches(`input:not(#${inputId}), textarea`)
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeSinceLastKeyPress = currentTime - lastKeyPressTime.current;
      lastKeyPressTime.current = currentTime;

      // Hızlı tuş basımı barkod taraması olarak algıla (50ms içinde)
      const isRapidKeyPress = timeSinceLastKeyPress <= 50;

      if (isRapidKeyPress && /^[a-zA-Z0-9]$/.test(event.key)) {
        setIsProcessingBarcode(true);
      }

      if (timeSinceLastKeyPress > 100) {
        setBarcodeBuffer("");
        setIsProcessingBarcode(false);
      }

      // Enter tuşu ile barkodu işle
      if (event.key === "Enter" && barcodeBuffer.length > 0) {
        if (!isFocused && onBarcodeDetected) {
          onBarcodeDetected(barcodeBuffer);
        } else {
          onSearchTermChange(barcodeBuffer);
        }

        setBarcodeBuffer("");
        setIsProcessingBarcode(false);
        return;
      }

      // Barkod buffer'ına alfanumerik karakterleri ekle
      if (/^[a-zA-Z0-9]$/.test(event.key)) {
        const newBuffer = barcodeBuffer + event.key;
        setBarcodeBuffer(newBuffer);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Otomatik gönderim için timeout
        timeoutRef.current = setTimeout(() => {
          if (newBuffer.length >= 3) {
            if (!isFocused && onBarcodeDetected) {
              onBarcodeDetected(newBuffer);
            } else {
              onSearchTermChange(newBuffer);
            }
          }

          setBarcodeBuffer("");
          setIsProcessingBarcode(false);
        }, 300);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    barcodeBuffer,
    isFocused,
    onBarcodeDetected,
    onSearchTermChange,
    inputRef,
    inputId,
    quantityModeActive,
    mode,
  ]);

  // Get placeholder text based on mode
  const getPlaceholder = () => {
    if (searchPlaceholder) return searchPlaceholder;

    switch (mode) {
      case "sales":
        return "Fiş numarası veya ID ara...";
      case "pos":
        return "Ürün Adı, Barkod veya Kategori Ara...";
      default:
        return "Ara...";
    }
  };

  // Apply date preset (sales mode)
  const applyDatePreset = (
    preset: "today" | "yesterday" | "last7days" | "last30days"
  ) => {
    if (!onFilterChange || mode !== "sales") return;

    const today = new Date();
    let startDate: Date, endDate: Date;

    switch (preset) {
      case "today":
        startDate = startOfDay(today);
        endDate = endOfDay(today);
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = startOfDay(yesterday);
        endDate = endOfDay(yesterday);
        break;
      case "last7days":
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        startDate = startOfDay(sevenDaysAgo);
        endDate = endOfDay(today);
        break;
      case "last30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        startDate = startOfDay(thirtyDaysAgo);
        endDate = endOfDay(today);
        break;
      default:
        return;
    }

    onFilterChange({
      ...filter,
      startDate,
      endDate,
    });
  };

  // Handle date changes (sales mode)
  const handleDateChange = (
    type: "startDate" | "endDate",
    date: Date | null
  ) => {
    if (!onFilterChange || mode !== "sales") return;

    if (date) {
      let adjustedDate = date;

      if (type === "startDate") {
        adjustedDate = startOfDay(date);
      } else if (type === "endDate") {
        adjustedDate = endOfDay(date);
      }

      onFilterChange({
        ...filter,
        [type]: adjustedDate,
      });
    } else {
      const newFilter = { ...filter };
      delete newFilter[type];
      onFilterChange(newFilter);
    }
  };

  // Handle filter changes (sales mode)
  const handleFilterChange = (key: string, value: any) => {
    if (!onFilterChange) return;

    const newFilter = {
      ...filter,
      [key]: value === "" ? undefined : value,
    };

    onFilterChange(newFilter);
  };

  // Display date range (sales mode)
  const displayDateRange = () => {
    if (filter.startDate && filter.endDate) {
      const start = formatDateDisplay(filter.startDate);
      const end = formatDateDisplay(filter.endDate);

      // Show single date if start and end are the same
      if (start === end) {
        return start;
      }

      return `${start} - ${end}`;
    }

    return "Tarih";
  };

  // Helper function to get filter tag color
  const getFilterTagColor = (key: string) => {
    const colorMap: Record<string, string> = {
      category: "blue",
      price: "emerald",
      stock: "amber",
      status: "violet",
      paymentMethod: "orange",
      hasDiscount: "purple",
      date: "indigo",
      default: "indigo",
    };

    return colorMap[key] || colorMap.default;
  };

  // Get CSS classes for filter tags
  const getFilterTagClasses = (color: string) => {
    const colorMap: Record<
      string,
      { bg: string; text: string; hoverText: string }
    > = {
      blue: {
        bg: "bg-blue-50",
        text: "text-blue-700",
        hoverText: "hover:text-blue-600",
      },
      emerald: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        hoverText: "hover:text-emerald-600",
      },
      amber: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        hoverText: "hover:text-amber-600",
      },
      violet: {
        bg: "bg-violet-50",
        text: "text-violet-700",
        hoverText: "hover:text-violet-600",
      },
      indigo: {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        hoverText: "hover:text-indigo-600",
      },
      orange: {
        bg: "bg-orange-50",
        text: "text-orange-700",
        hoverText: "hover:text-orange-600",
      },
      purple: {
        bg: "bg-purple-50",
        text: "text-purple-700",
        hoverText: "hover:text-purple-600",
      },
      red: {
        bg: "bg-red-50",
        text: "text-red-700",
        hoverText: "hover:text-red-600",
      },
    };

    const colorClasses = colorMap[color] || colorMap.indigo;
    return `${colorClasses.bg} ${colorClasses.text}`;
  };

  // Render filter panel based on mode
  const renderFilterPanel = () => {
    if (filterPanelContent) {
      return filterPanelContent;
    }

    if (mode === "sales" && isFilterShown) {
      return (
        <div
          ref={filterRef}
          className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl z-20 border border-gray-100 w-80 p-4 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-800">Filtreler</h3>
            <button
              onClick={onReset}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Tümünü Temizle
            </button>
          </div>

          <div className="space-y-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarih Aralığı
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="date"
                  value={
                    filter?.startDate
                      ? new Date(filter.startDate).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    handleDateChange(
                      "startDate",
                      e.target.value ? new Date(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Başlangıç"
                />
                <input
                  type="date"
                  value={
                    filter?.endDate
                      ? new Date(filter.endDate).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    handleDateChange(
                      "endDate",
                      e.target.value ? new Date(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Bitiş"
                />
              </div>

              {/* Quick date selections */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => applyDatePreset("today")}
                  className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
                >
                  Bugün
                </button>
                <button
                  onClick={() => applyDatePreset("yesterday")}
                  className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
                >
                  Dün
                </button>
                <button
                  onClick={() => applyDatePreset("last7days")}
                  className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
                >
                  Son 7 Gün
                </button>
                <button
                  onClick={() => applyDatePreset("last30days")}
                  className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
                >
                  Son 30 Gün
                </button>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum
              </label>
              <select
                value={filter?.status || ""}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Tümü</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal Edildi</option>
                <option value="refunded">İade Edildi</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ödeme Yöntemi
              </label>
              <select
                value={filter?.paymentMethod || ""}
                onChange={(e) =>
                  handleFilterChange("paymentMethod", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Tümü</option>
                <option value="nakit">Nakit</option>
                <option value="kart">Kredi Kartı</option>
                <option value="veresiye">Veresiye</option>
                <option value="nakitpos">POS (Nakit)</option>
                <option value="mixed">Karışık (Split)</option>
              </select>
            </div>

            {/* Min/Max Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min. Tutar
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">₺</span>
                  </div>
                  <input
                    type="number"
                    value={filter?.minAmount || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "minAmount",
                        e.target.value ? parseFloat(e.target.value) : ""
                      )
                    }
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max. Tutar
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">₺</span>
                  </div>
                  <input
                    type="number"
                    value={filter?.maxAmount || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "maxAmount",
                        e.target.value ? parseFloat(e.target.value) : ""
                      )
                    }
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              </div>
            </div>

            {/* Discount Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İndirim Durumu
              </label>
              <select
                value={
                  filter?.hasDiscount === undefined
                    ? ""
                    : filter.hasDiscount
                    ? "true"
                    : "false"
                }
                onChange={(e) => {
                  const value = e.target.value;
                  handleFilterChange(
                    "hasDiscount",
                    value === "" ? undefined : value === "true"
                  );
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Tümü</option>
                <option value="true">İndirimli Satışlar</option>
                <option value="false">İndirimsiz Satışlar</option>
              </select>
            </div>

            {/* Close button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  if ((mode as FilterPanelMode) === "pos" && toggleFilter) {
                    toggleFilter();
                  } else {
                    setInternalShowFilter(false);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <CheckCircle size={16} />
                Kapat
              </button>
            </div>
          </div>
        </div>
      );
    }

    // For POS mode, don't render filter panel. It should be provided by parent
    return null;
  };

  // Render active filters based on mode
  const defaultRenderActiveFilters = () => {
    // For POS and basic modes, use provided activeFilters
    if ((mode === "pos" || mode === "basic") && activeFilters.length > 0) {
      return activeFilters.map((filter, index) => {
        const color = filter.color || getFilterTagColor(filter.key);
        const tagClasses = getFilterTagClasses(color);

        return (
          <span
            key={`${filter.key}-${index}`}
            className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium ${tagClasses}`}
          >
            {filter.icon || <Tag size={14} />}
            {filter.label}: {filter.value}
            <button
              onClick={() => {
                // Eğer onFilterRemove sağlandıysa, değer (value) ile birlikte kaldır
                if (onFilterRemove) {
                  onFilterRemove(filter.key, filter.value);
                } else if (filter.onRemove) {
                  // Geri dönük uyumluluk için
                  filter.onRemove();
                } else if (activeFilters.length === 1) {
                  // Son filtre ise tümünü temizle
                  onReset();
                }
              }}
              className="text-gray-400 hover:text-gray-600 ml-1"
            >
              <XCircle size={14} />
            </button>
          </span>
        );
      });
    }

    // For sales mode, generate from filter object
    if (mode === "sales" && filter) {
      return (
        <>
          {filter.startDate && filter.endDate && (
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
              <CalendarRange size={14} />
              {displayDateRange()}
              <button
                onClick={() =>
                  onFilterChange?.({
                    ...filter,
                    startDate: undefined,
                    endDate: undefined,
                  })
                }
                className="text-indigo-400 hover:text-indigo-600 ml-1"
              >
                <XCircle size={14} />
              </button>
            </span>
          )}

          {filter.status && (
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              <Tag size={14} />
              {filter.status === "completed"
                ? "Tamamlandı"
                : filter.status === "cancelled"
                ? "İptal Edildi"
                : filter.status === "refunded"
                ? "İade Edildi"
                : filter.status}
              <button
                onClick={() => handleFilterChange("status", "")}
                className="text-blue-400 hover:text-blue-600 ml-1"
              >
                <XCircle size={14} />
              </button>
            </span>
          )}

          {(filter.minAmount !== undefined ||
            filter.maxAmount !== undefined) && (
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
              <DollarSign size={14} />
              {filter.minAmount !== undefined && filter.maxAmount !== undefined
                ? `₺${filter.minAmount} - ₺${filter.maxAmount}`
                : filter.minAmount !== undefined
                ? `≥ ₺${filter.minAmount}`
                : `≤ ₺${filter.maxAmount}`}
              <button
                onClick={() =>
                  onFilterChange?.({
                    ...filter,
                    minAmount: undefined,
                    maxAmount: undefined,
                  })
                }
                className="text-emerald-400 hover:text-emerald-600 ml-1"
              >
                <XCircle size={14} />
              </button>
            </span>
          )}

          {filter.paymentMethod && (
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
              <CreditCard size={14} />
              {filter.paymentMethod === "nakit"
                ? "Nakit"
                : filter.paymentMethod === "kart"
                ? "Kredi Kartı"
                : filter.paymentMethod === "veresiye"
                ? "Veresiye"
                : filter.paymentMethod === "nakitpos"
                ? "POS (Nakit)"
                : filter.paymentMethod === "mixed"
                ? "Karışık (Split)"
                : filter.paymentMethod}
              <button
                onClick={() => handleFilterChange("paymentMethod", "")}
                className="text-orange-400 hover:text-orange-600 ml-1"
              >
                <XCircle size={14} />
              </button>
            </span>
          )}

          {filter.hasDiscount !== undefined && (
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
              <Percent size={14} />
              {filter.hasDiscount
                ? "İndirimli Satışlar"
                : "İndirimsiz Satışlar"}
              <button
                onClick={() => handleFilterChange("hasDiscount", undefined)}
                className="text-purple-400 hover:text-purple-600 ml-1"
              >
                <XCircle size={14} />
              </button>
            </span>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <div className="relative">
      {/* Search and Filter Toolbar */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        {/* Sol: Arama */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search
              size={mode === "pos" ? 20 : 18}
              className={
                mode === "pos" && isFocused
                  ? "text-indigo-600"
                  : "text-gray-400"
              }
            />
          </div>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            placeholder={getPlaceholder()}
            value={searchTerm}
            onChange={(e) => {
              // Türkçe karakter desteği olan arama fonksiyonu için sadece değeri iletiyoruz
              onSearchTermChange(e.target.value);
            }}
            onFocus={() => {
              if (mode === "pos") setIsFocused(true);
            }}
            onBlur={() => {
              if (mode === "pos") setIsFocused(false);
            }}
            className={`block w-full pl-10 pr-${
              searchTerm ? "12" : "3"
            } py-2.5 border rounded-lg 
                      focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 
                      text-gray-900 placeholder-gray-500 
                      ${
                        mode === "pos" && isProcessingBarcode
                          ? "bg-green-50 border-green-300 ring-green-200 ring-2"
                          : "bg-gray-50 border-gray-300"
                      }`}
          />

          {/* Barcode scanning indicator (POS mode) 
          {mode === "pos" && isProcessingBarcode && (
            <div className="absolute inset-y-0 right-12 flex items-center">
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                Barkod Taranıyor...
              </span>
            </div>
          )}*/}

          {/* Clear button */}
          {searchTerm && (
            <button
              onClick={() => onSearchTermChange("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-indigo-600">
              <Loader2 size={18} className="animate-spin" />
            </div>
          )}
        </div>

        {/* Right: Filter Button & Additional Actions */}
        <div className="flex items-center gap-2">
          {/* Filter Button with Dropdown */}
          <div className="relative inline-block">
            <button
              ref={toggleButtonRef} /* Toggle butonu referansını ekledik */
              onClick={handleToggleFilter}
              className={`flex items-center gap-2 py-3 px-4 rounded-lg border transition-all font-medium text-sm ${
                isFilterShown || activeFilterCount > 0
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 hover:border-indigo-300 text-gray-700"
              }`}
            >
              <Filter
                size={18}
                className={
                  activeFilterCount > 0 ? "text-indigo-600" : "text-gray-500"
                }
              />
              <span>
                {activeFilterCount > 0
                  ? `Filtreler (${activeFilterCount})`
                  : "Filtrele"}
              </span>
              <ChevronDown
                size={16}
                className={
                  isFilterShown
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
            </button>

            {/* Filter Panel */}
            {renderFilterPanel()}
          </div>

          {/* Refresh Button - Only shown if provided */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`flex items-center gap-2 py-3 px-4 rounded-lg border border-gray-300 hover:border-indigo-300 text-gray-700 transition-all font-medium text-sm ${
                isLoading ? "cursor-not-allowed opacity-75" : ""
              }`}
              disabled={isLoading}
            >
              <RefreshCw
                size={18}
                className={`text-gray-500 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>{isLoading ? "Yükleniyor" : "Yenile"}</span>
            </button>
          )}

          {/* Reset Button - Only shown in specific modes */}
          {mode === "pos" && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 py-3 px-4 rounded-lg border border-gray-300 hover:border-indigo-300 text-gray-700 transition-all font-medium text-sm"
            >
              <RefreshCw size={18} className="text-gray-500" />
              <span>Sıfırla</span>
            </button>
          )}
        </div>
      </div>
      {/* Active Filters Display - Added overflow-hidden to prevent layout shifts */}
      {/* Only render the filter section if there are actual filters to display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-4 overflow-hidden">
          {/* Özel render fonksiyonu varsa onu, yoksa varsayılan render fonksiyonunu kullan */}
          {renderActiveFilters
            ? renderActiveFilters()
            : defaultRenderActiveFilters()}

          {/* Clear all filters button */}
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
          >
            <XCircle size={14} />
            Tüm Filtreleri Temizle
          </button>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
