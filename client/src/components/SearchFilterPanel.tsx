import React, { useEffect, useState, useRef } from "react";
import { Search, Filter, RefreshCw } from "lucide-react";

interface SearchFilterPanelProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onReset: () => void;
  showFilter: boolean;
  toggleFilter: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  onBarcodeDetected?: (barcode: string) => void; // Barkod tarandığında çağrılacak fonksiyon
  inputActive?: boolean; // Arama alanına odaklanılıp odaklanılmadığını izlemek için
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
}) => {
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const lastKeyPressTime = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Barkod taramasını dinlemek için
  useEffect(() => {
    // Klavye olayını dinleyecek fonksiyon
    const handleKeyDown = (event: KeyboardEvent) => {
      // Debug bilgisi
      console.log("Key down:", event.key, "Active element:", document.activeElement?.tagName);
      
      // Eğer arama kutusu dışında başka bir input veya textarea üzerinde yazıyorsak
      // ve bu element bizim arama kutumuz değilse, işlemi atla
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
         document.activeElement.tagName === "TEXTAREA") &&
        inputRef?.current !== document.activeElement
      ) {
        // Başka bir input alanına yazılıyor
        console.log("Başka bir input alanında yazılıyor, barkod algılama devre dışı");
        return;
      }

      // Zaman kontrolü
      const currentTime = Date.now();
      const timeSinceLastKeyPress = currentTime - lastKeyPressTime.current;
      lastKeyPressTime.current = currentTime;
      
      console.log("Son tuş basma süresi:", timeSinceLastKeyPress, "ms");
      
      // Barkodlar genellikle çok hızlı gelir (< 100ms)
      // Eğer yavaş yazılıyorsa barkod olarak algılama
      if (timeSinceLastKeyPress > 100) {
        console.log("Yavaş yazım tespit edildi, barkod bufferı temizleniyor");
        setBarcodeBuffer(""); // Yeni giriş başlat
      }

      // Enter tuşuna basıldığında ve bir barkod varsa
      if (event.key === "Enter" && barcodeBuffer.length > 0) {
        console.log("Enter tuşu, mevcut barkod buffer:", barcodeBuffer);
        
        if (!isFocused && onBarcodeDetected) {
          console.log("Arama kutusuna odaklanılmamış, barkod sepete ekleniyor:", barcodeBuffer);
          onBarcodeDetected(barcodeBuffer);
        } else {
          console.log("Arama kutusuna odaklanılmış, normal arama yapılıyor:", barcodeBuffer);
          onSearchTermChange(barcodeBuffer);
        }
        
        setBarcodeBuffer(""); // Buffer'ı temizle
        return;
      }

      // Alfanumerik karakterleri buffer'a ekle
      if (/^[a-zA-Z0-9]$/.test(event.key)) {
        const newBuffer = barcodeBuffer + event.key;
        console.log("Barkod buffer güncellendi:", newBuffer);
        setBarcodeBuffer(newBuffer);
        
        // Varolan timeout'u temizle
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Yeni timeout ayarla
        timeoutRef.current = setTimeout(() => {
          console.log("Timeout tetiklendi, mevcut buffer:", newBuffer);
          
          // En az 3 karakter varsa barkod olarak değerlendir
          if (newBuffer.length >= 3) {
            if (!isFocused && onBarcodeDetected) {
              console.log("Timeout üzerine barkod algılandı, sepete ekleniyor:", newBuffer);
              onBarcodeDetected(newBuffer);
            } else {
              console.log("Timeout üzerine arama terimi güncelleniyor:", newBuffer);
              onSearchTermChange(newBuffer);
            }
          }
          
          setBarcodeBuffer(""); // Her durumda temizle
        }, 300); // 300ms içinde yeni giriş olmazsa tamamlandı say
      }
    };

    // Olay dinleyicisini ekle
    window.addEventListener("keydown", handleKeyDown);
    
    // Temizleme fonksiyonu
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      
      // Varolan timeout'u temizle
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [barcodeBuffer, isFocused, onBarcodeDetected, onSearchTermChange, inputRef]);

  return (
    <div className="flex gap-2 mb-4">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Ara..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          onFocus={() => {
            console.log("SearchFilterPanel input focus aldı");
            setIsFocused(true);
          }}
          onBlur={() => {
            console.log("SearchFilterPanel input focus kaybetti");
            setIsFocused(false);
          }}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
      </div>
      <button
        onClick={toggleFilter}
        className={`p-2 border rounded-lg hover:bg-gray-50 ${
          showFilter ? "bg-primary-50 border-primary-500" : ""
        }`}
        title="Filtreleri Göster/Gizle"
      >
        <Filter size={20} className="text-gray-600" />
      </button>
      <button
        onClick={onReset}
        className="p-2 border rounded-lg hover:bg-gray-50"
        title="Filtreleri Sıfırla"
      >
        <RefreshCw size={20} className="text-gray-600" />
      </button>
    </div>
  );
};

export default SearchFilterPanel;