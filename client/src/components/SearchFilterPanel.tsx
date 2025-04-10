import React, { useEffect, useState, useRef } from "react";
import { Search, Filter, RefreshCw, X, Loader2, Scan } from "lucide-react";

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
  quantityModeActive?: boolean; // Yeni prop: Yıldız modu durumunu kontrol et
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
  quantityModeActive = false, // Varsayılan değer: false
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
    quantityModeActive, // Bağımlılık listesine eklendi
  ]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Ana Arama Kutusu */}
        <div className="flex-1 relative">
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
              className={`w-full pl-11 pr-12 h-11 bg-white border rounded-xl shadow-sm 
                         text-gray-800 text-base placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:border-indigo-500
                         transition-all duration-200 ease-in-out
                         ${isProcessingBarcode ? 'border-green-500 ring-green-200 ring-2' : 'border-gray-200 focus:ring-indigo-500'}`}
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

        {/* Butonlar Kısmı */}
        <div className="flex gap-2 justify-end">
          {/* Filtre Butonu - Sabit Genişlik */}
          <button
            onClick={toggleFilter}
            className={`h-11 w-11 md:w-auto border rounded-xl flex items-center justify-center md:justify-start md:gap-2 md:px-3.5 transition-all duration-200
                      hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500
                      ${
                        showFilter
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
            title={showFilter ? "Filtreleri Gizle" : "Filtreleri Göster"}
            aria-label={showFilter ? "Filtreleri Gizle" : "Filtreleri Göster"}
          >
            <Filter size={18} />
            <span className="font-medium hidden md:block whitespace-nowrap">
              Filtreler
            </span>
            {showFilter && (
              <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-0.5 rounded-full ml-1 hidden md:inline-block">
                Aktif
              </span>
            )}
            {showFilter && (
              <span className="absolute -top-1 -right-1 bg-indigo-500 w-2.5 h-2.5 rounded-full md:hidden"></span>
            )}
          </button>

          {/* Sıfırlama Butonu - Sabit Genişlik */}
          <button
            onClick={onReset}
            className="h-11 w-11 md:w-auto bg-white border border-gray-200 rounded-xl flex items-center justify-center md:justify-start md:gap-2 md:px-3.5
                     hover:bg-gray-50 hover:shadow-sm transition-all duration-200
                     focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500"
            title="Arama ve Filtreleri Sıfırla"
            aria-label="Arama ve Filtreleri Sıfırla"
          >
            <RefreshCw size={18} className="text-gray-600" />
            <span className="font-medium text-gray-700 hidden md:block whitespace-nowrap">
              Sıfırla
            </span>
          </button>
        </div>
      </div>

      {/* Filtre Açıklaması - Filtreler aktifse göster */}
      {showFilter && (
        <div className="mt-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-800">
          <div className="flex items-center">
            <Filter size={16} className="mr-2 text-indigo-600" />
            <span className="font-medium">Aktif Filtreler:</span>
            <span className="ml-2">Tüm filtreler uygulanıyor</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilterPanel;