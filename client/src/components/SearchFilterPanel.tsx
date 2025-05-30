import React, { useEffect, useState, useRef } from "react";
import { Search, Filter, RefreshCw, X, Loader2, Scan, CheckCircle, Tag, Settings, ChevronDown, XCircle } from "lucide-react";

interface SearchFilterPanelProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onReset: () => void;
  showFilter: boolean;
  toggleFilter: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  onBarcodeDetected?: (barcode: string) => void;
  inputActive?: boolean;
  loading?: boolean;
  onScanModeChange?: (isScanning: boolean) => void;
  inputId?: string;
  quantityModeActive?: boolean;
  // Aktif filtreleri görüntülemek için yeni prop ekleyebiliriz
  activeFilters?: Array<{key: string, label: string, value: string, color?: string}>;
}

const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({
  searchTerm,
  onSearchTermChange,
  onReset,
  showFilter,
  toggleFilter,
  inputRef,
  onBarcodeDetected,
  inputActive,
  loading = false,
  onScanModeChange,
  inputId = "searchInput",
  quantityModeActive = false,
  activeFilters = [], // Varsayılan değer boş dizi
}) => {
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isProcessingBarcode, setIsProcessingBarcode] = useState(false);
  const lastKeyPressTime = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Barkod işleme durumunu parent bileşene bildir
  useEffect(() => {
    onScanModeChange?.(isProcessingBarcode);
  }, [isProcessingBarcode, onScanModeChange]);

  // Barkod taramasını dinlemek için
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ÖNEMLİ: Yıldız modu aktifse hiçbir tuşu işleme
      if (quantityModeActive) {
        console.log("Yıldız modu aktif - SearchFilterPanel tuşları işlemiyor");
        return;
      }

      // YILDIZ TUŞU: Eğer arama kutusuna odaklanılmamışsa işleme
      if (event.key === "*") {
        // Eğer arama kutusuna odaklanılmışsa normal davranış devam etsin
        if (document.activeElement === inputRef?.current) {
          return;
        }
        
        // Aksi takdirde, bu tuşu useHotkeys hook'unun işlemesine izin ver
        return;
      }

      // Eğer başka bir input veya textarea alanında yazılıyorsa, barkod algılamayı devre dışı bırak
      if (
        document.activeElement &&
        document.activeElement.matches("input:not(#" + inputId + "), textarea")
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeSinceLastKeyPress = currentTime - lastKeyPressTime.current;
      lastKeyPressTime.current = currentTime;

      // Hızlı tuş basımlarını barkod taraması olarak tanımla
      const isRapidKeyPress = timeSinceLastKeyPress <= 50; // 50ms

      // Tuş basımı hızlıysa ve alfanumerik karakter basılmışsa, barkod tarama modu aktif
      if (isRapidKeyPress && /^[a-zA-Z0-9]$/.test(event.key)) {
        setIsProcessingBarcode(true);
      }

      if (timeSinceLastKeyPress > 100) {
        setBarcodeBuffer("");
        setIsProcessingBarcode(false);
      }

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

      if (/^[a-zA-Z0-9]$/.test(event.key)) {
        const newBuffer = barcodeBuffer + event.key;
        setBarcodeBuffer(newBuffer);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

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
  ]);

  // Aktif filtrelerin sayısını belirle
  const activeFilterCount = activeFilters.length > 0 ? activeFilters.length : (showFilter ? 1 : 0);
  
  // Filtre etiketinin rengini belirlemek için helper fonksiyon
  const getFilterTagColor = (key: string) => {
    const colorMap: Record<string, string> = {
      'category': 'blue',
      'price': 'emerald',
      'stock': 'amber',
      'status': 'violet',
      'default': 'indigo'
    };
    
    return colorMap[key] || colorMap.default;
  };
  
  // Filtre rengine bağlı CSS sınıflarını belirle
  const getFilterTagClasses = (color: string) => {
    const colorMap: Record<string, {bg: string, text: string, hoverText: string}> = {
      'blue': {bg: 'bg-blue-50', text: 'text-blue-700', hoverText: 'hover:text-blue-600'},
      'emerald': {bg: 'bg-emerald-50', text: 'text-emerald-700', hoverText: 'hover:text-emerald-600'},
      'amber': {bg: 'bg-amber-50', text: 'text-amber-700', hoverText: 'hover:text-amber-600'},
      'violet': {bg: 'bg-violet-50', text: 'text-violet-700', hoverText: 'hover:text-violet-600'},
      'indigo': {bg: 'bg-indigo-50', text: 'text-indigo-700', hoverText: 'hover:text-indigo-600'},
    };
    
    const colorClasses = colorMap[color] || colorMap.indigo;
    return `${colorClasses.bg} ${colorClasses.text}`;
  };

  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm mb-3">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        {/* Sol: Arama */}
        <div className="relative flex-1">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              {isProcessingBarcode ? (
                <Scan className="text-green-500 animate-pulse" size={20} />
              ) : (
                <Search
                  className={`${
                    isFocused ? "text-indigo-600" : "text-gray-400"
                  } transition-colors duration-200`}
                  size={20}
                />
              )}
            </div>

            <input
              id={inputId}
              ref={inputRef}
              type="text"
              placeholder="Ürün Adı, Barkod veya Kategori Ara..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              onFocus={() => {
                setIsFocused(true);
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
              className={`w-full pl-11 pr-12 py-2.5 border rounded-lg shadow-sm 
                         text-gray-800 text-base placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:border-indigo-500 
                         transition-all duration-200 ease-in-out
                         ${isProcessingBarcode ? 'bg-green-50 border-green-300 ring-green-200 ring-2' : 'bg-gray-50 border-gray-300 focus:ring-indigo-500'}`}
              aria-label="Arama"
            />

            {/* Barkod tarama modu göstergesi */}
            {isProcessingBarcode && (
              <div className="absolute inset-y-0 right-12 flex items-center">
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  Barkod Taranıyor...
                </span>
              </div>
            )}

            {/* Temizleme Butonu */}
            {searchTerm && (
              <button
                onClick={() => onSearchTermChange("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                title="Aramayı Temizle"
                aria-label="Aramayı Temizle"
              >
                <X size={18} />
              </button>
            )}

            {/* Yükleniyor Göstergesi */}
            {loading && (
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-indigo-600">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
          </div>
        </div>
        
        {/* Sağ: Filtre ve Sıfırlama Butonları */}
        <div className="flex space-x-3">
          {/* Filtre Butonu */}
          <button
            onClick={toggleFilter}
            className={`flex items-center gap-2 py-2.5 px-4 rounded-lg border transition-all font-medium text-sm ${
              showFilter || activeFilterCount > 0
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-300 hover:border-indigo-300 text-gray-700"
            }`}
          >
            <Filter 
              size={18} 
              className={activeFilterCount > 0 ? "text-indigo-600" : "text-gray-500"} 
            />
            <span>
              {activeFilterCount > 0 ? `Filtreler (${activeFilterCount})` : "Filtrele"}
            </span>
            <ChevronDown size={16} className={showFilter ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          
          {/* Sıfırlama Butonu */}
          <button
            onClick={onReset}
            className="flex items-center gap-2 py-2.5 px-4 rounded-lg border border-gray-300 hover:border-indigo-300 text-gray-700 transition-all font-medium text-sm"
          >
            <RefreshCw
              size={18}
              className="text-gray-500"
            />
            <span>Sıfırla</span>
          </button>
        </div>
      </div>

      {/* Aktif Filtreler - Etiketler olarak */}
      {(activeFilters.length > 0 || showFilter) && (
        <div className="flex flex-wrap gap-2 mt-4">
          {/* Filtreleri etiketler olarak göster */}
          {activeFilters.map((filter, index) => {
            const color = filter.color || getFilterTagColor(filter.key);
            const tagClasses = getFilterTagClasses(color);
            
            return (
              <span 
                key={`${filter.key}-${index}`} 
                className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium ${tagClasses}`}
              >
                <Tag size={14} />
                {filter.label}: {filter.value}
                <button 
                  onClick={() => {
                    // Burada filtre kaldırma fonksiyonu çağrılabilir
                    // Şu an için demo olarak boş bırakıyoruz
                    console.log(`Filtre kaldırıldı: ${filter.key}`);
                  }}
                  className={`text-${color}-400 hover:text-${color}-600 ml-1`}
                >
                  <XCircle size={14} />
                </button>
              </span>
            );
          })}
          
          {/* Filtre açıklaması - Filtreler aktifse göster */}
          {showFilter && (
            <div className="animate-in fade-in slide-in-from-top-5 duration-200 w-full mt-2">
              <div className="px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-800">
                <div className="flex items-center">
                  <Settings size={16} className="mr-2 text-indigo-600" />
                  <span className="font-medium">Filtre Paneli Açık:</span>
                  <span className="ml-2">Filtrelerinizi yapılandırın ve ürünleri filtrelemeye başlayın</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Tüm Filtreleri Temizle Butonu - Filtreler aktifse göster */}
          {activeFilters.length > 0 && (
            <button 
              onClick={onReset}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
            >
              <XCircle size={14} />
              Tüm Filtreleri Temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFilterPanel;