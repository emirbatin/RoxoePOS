// hooks/useHotkeys.ts - Güncellenmiş versiyon
import { useState, useEffect, useCallback, useRef } from "react";

interface Hotkey {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  callback: () => void;
}

interface CustomHotkeySettings {
  id: string;
  description: string;
  defaultKey: string;
  defaultModifier: boolean;
  currentKey: string;
  currentModifier: boolean;
}

interface SpecialHotkeySettings {
  id: string;
  description: string;
  type: "quantity" | "numpad";
  defaultTrigger: string;
  currentTrigger: string;
  defaultTerminator?: string;
  currentTerminator?: string;
  isEditable?: boolean;
}

interface UseHotkeysOptions {
  hotkeys: Hotkey[];
  onQuantityUpdate?: (quantity: number) => void;
  shouldHandleEvent?: (event: KeyboardEvent) => boolean;
}

// Kısayol ayarlarını yükleme - ayrı fonksiyon olarak tanımlandı
const loadHotkeySettings = () => {
  try {
    const savedHotkeys = localStorage.getItem("hotkeySettings");
    const savedSpecialHotkeys = localStorage.getItem("specialHotkeySettings");
    
    // Yüklenen ayarları loglama (debug için)
    console.log("Loaded hotkey settings:", savedHotkeys ? JSON.parse(savedHotkeys) : "None");
    console.log("Loaded special hotkey settings:", savedSpecialHotkeys ? JSON.parse(savedSpecialHotkeys) : "None");
    
    return {
      hotkeySettings: savedHotkeys ? JSON.parse(savedHotkeys) : null,
      specialHotkeySettings: savedSpecialHotkeys ? JSON.parse(savedSpecialHotkeys) : null
    };
  } catch (error) {
    console.error("Error loading hotkey settings:", error);
    return { hotkeySettings: null, specialHotkeySettings: null };
  }
};

export const useHotkeys = ({
  hotkeys,
  onQuantityUpdate,
  shouldHandleEvent = () => true,
}: UseHotkeysOptions) => {
  const [quantityMode, setQuantityMode] = useState(false);
  const [tempQuantity, setTempQuantity] = useState("");
  
  // Ayar değişikliklerini izlemek için kullanılan ref
  const hotkeySettingsRef = useRef<CustomHotkeySettings[] | null>(null);
  const specialHotkeySettingsRef = useRef<SpecialHotkeySettings[] | null>(null);
  
  // İlk kez ayarları yükle
  useEffect(() => {
    const { hotkeySettings, specialHotkeySettings } = loadHotkeySettings();
    hotkeySettingsRef.current = hotkeySettings;
    specialHotkeySettingsRef.current = specialHotkeySettings;
  }, []);
  
  // Kısayol ayarı değişikliklerini dinle
  useEffect(() => {
    const handleHotkeySettingsChanged = () => {
      console.log("Hotkey settings changed event detected");
      const { hotkeySettings, specialHotkeySettings } = loadHotkeySettings();
      hotkeySettingsRef.current = hotkeySettings;
      specialHotkeySettingsRef.current = specialHotkeySettings;
    };
    
    // Özel bir olay tanımladık
    window.addEventListener("hotkeySettingsChanged", handleHotkeySettingsChanged);
    
    return () => {
      window.removeEventListener("hotkeySettingsChanged", handleHotkeySettingsChanged);
    };
  }, []);

  // Özel tuşları işleyen fonksiyon
  const handleSpecialKeys = useCallback(
    (e: KeyboardEvent) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Eğer aktif element bir input veya textarea ise ve searchInput değilse, olayları işleme
      if (
        document.activeElement && 
        document.activeElement.matches("input:not(#searchInput), textarea")
      ) {
        return false; // Bu case'de hiçbir tuşu işlemeyeceğiz
      }

      // Yıldız karakteri için özel hotkey ayarını kontrol et
      const specialHotkeys = specialHotkeySettingsRef.current;
      const starModeHotkey = specialHotkeys?.find(h => h.id === "star_mode");
      const starTrigger = starModeHotkey?.currentTrigger || "*";
      
      // Yıldız modu işlemesi - güncel ayara göre
      if (e.key === starTrigger && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Eğer arama inputu aktifse, normal davranış devam etsin
        if (document.activeElement?.id === "searchInput") {
          return false;
        }
        
        e.preventDefault();
        setQuantityMode(true);
        setTempQuantity("");
        console.log(`Quantity mode activated with trigger: ${starTrigger}`);
        return true;
      }

      // Yıldız modu aktifse sayı girişi
      if (quantityMode) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          setTempQuantity((prev) => prev + e.key);
          console.log("Quantity updated:", tempQuantity + e.key);
          return true;
        }

        // Enter tuşu - miktarı onayla
        if (e.key === "Enter") {
          e.preventDefault();
          console.log("Quantity confirmed:", tempQuantity);
          
          if (tempQuantity !== "" && onQuantityUpdate) {
            const newQuantity = parseInt(tempQuantity, 10);
            if (!isNaN(newQuantity) && newQuantity > 0) {
              onQuantityUpdate(newQuantity);
            }
          }
          
          setQuantityMode(false);
          setTempQuantity("");
          return true;
        }

        // Escape veya herhangi bir başka tuş - yıldız modunu iptal et
        if (e.key === "Escape" || !/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          console.log("Quantity mode canceled");
          setQuantityMode(false);
          setTempQuantity("");
          return true;
        }
        
        return true; // Yıldız modu aktifken tüm tuşları engelle
      }

      // Normal hotkeys işlemesi - güncel ayarlara göre
      // Kaydedilmiş kısayolları kontrol et
      const savedHotkeys = hotkeySettingsRef.current;
      
      for (const hotkey of hotkeys) {
        // Bu hotkey için kaydedilmiş bir ayar var mı?
        const savedHotkey = savedHotkeys?.find(h => {
          // Hotkey ID eşleşmesini bul
          // Burada biraz tahmin gerekiyor çünkü hotkey objeleri ile savedHotkey objeleri arasında 
          // direkt bir ID ilişkisi yok. Kısayol açıklamasına veya fonksiyonuna göre eşleştirme yapılabilir.
          if (h.id === "new_sale" && hotkey.callback.name.includes("startNewSale")) return true;
          if (h.id === "payment" && hotkey.ctrlKey && hotkey.key === "p") return true;
          if (h.id === "cancel" && hotkey.key === "Escape") return true;
          if (h.id === "search_focus" && hotkey.ctrlKey && hotkey.key === "k") return true;
          if (h.id === "new_tab" && hotkey.ctrlKey && hotkey.key === "t") return true;
          if (h.id === "close_tab" && hotkey.ctrlKey && hotkey.key === "w") return true;
          if (h.id === "switch_tab" && hotkey.ctrlKey && hotkey.key === "Tab") return true;
          if (h.id === "quick_cash_payment" && hotkey.key === "F7") return true;
          if (h.id === "quick_card_payment" && hotkey.key === "F8") return true;
          return false;
        });
        
        // Eğer kaydedilmiş ayar bulunduysa, onu kullan
        const keyToCheck = savedHotkey ? savedHotkey.currentKey : hotkey.key;
        const modifierToCheck = savedHotkey ? savedHotkey.currentModifier : hotkey.ctrlKey;
        
        if (
          e.key.toLowerCase() === keyToCheck.toLowerCase() &&
          (modifierToCheck === undefined || modifierToCheck === ctrlKey) &&
          (hotkey.altKey === undefined || hotkey.altKey === e.altKey) &&
          (hotkey.shiftKey === undefined || hotkey.shiftKey === e.shiftKey)
        ) {
          e.preventDefault();
          console.log(`Executing hotkey: ${keyToCheck} (${savedHotkey ? 'custom' : 'default'})`);
          hotkey.callback();
          return true;
        }
      }

      return false;
    },
    [hotkeys, quantityMode, tempQuantity, onQuantityUpdate]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Dışarıdan gelen kontrol fonksiyonu önce çalıştırılır
      if (!shouldHandleEvent(e)) {
        return;
      }

      // Özel tuşları işle
      const handled = handleSpecialKeys(e);
      
      // Eğer özel tuşlar işlendiyse, durumu logla
      if (handled) {
        console.log("Event handled by useHotkeys:", e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleSpecialKeys, shouldHandleEvent]);

  // Yıldız modu değiştiğinde loglama
  useEffect(() => {
    if (quantityMode) {
      console.log("Quantity mode is active. Current quantity:", tempQuantity);
    }
  }, [quantityMode, tempQuantity]);

  return { 
    quantityMode, 
    tempQuantity,
    resetQuantityMode: () => {
      setQuantityMode(false);
      setTempQuantity("");
    }
  };
};

export default useHotkeys;