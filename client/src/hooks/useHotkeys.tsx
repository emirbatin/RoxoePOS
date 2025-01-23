import { useEffect, useCallback, useState } from "react";
import { UseHotkeysProps, HotkeyConfig, HotkeysHelperProps } from "../types/hotkey";

const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

export const useHotkeys = ({
  hotkeys,
  onQuantityUpdate,
}: UseHotkeysProps): void => {
  const [quantityMode, setQuantityMode] = useState(false);
  const [tempQuantity, setTempQuantity] = useState("");

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key.match(/^F\d+$/)) {
        event.preventDefault();
      }

      // * tuşuna basıldığında
      if (event.key === "*") {
        event.preventDefault();
        setQuantityMode(true);
        setTempQuantity("");
        return;
      }

      // Miktar modundayken
      if (quantityMode) {
        // Sayı girildiğinde
        if (/[0-9]/.test(event.key)) {
          setTempQuantity((prev) => prev + event.key);
        }
        // Enter'a basıldığında
        else if (event.key === "Enter" && tempQuantity) {
          const newQuantity = parseInt(tempQuantity);
          if (!isNaN(newQuantity) && onQuantityUpdate) {
            onQuantityUpdate(newQuantity);
          }
          setQuantityMode(false);
          setTempQuantity("");
        }
      }

      hotkeys.forEach(
        ({ key, callback, ctrlKey, metaKey, altKey, shiftKey }) => {
          const matchesKey = event.key.toLowerCase() === key.toLowerCase();
          const matchesCtrl = isMac ? true : !!event.ctrlKey === !!ctrlKey;
          const matchesCmd = isMac ? !!event.metaKey === !!ctrlKey : true;
          const matchesAlt = !!event.altKey === !!altKey;
          const matchesShift = !!event.shiftKey === !!shiftKey;

          if (
            matchesKey &&
            matchesCtrl &&
            matchesCmd &&
            matchesAlt &&
            matchesShift
          ) {
            callback(event);
          }
        }
      );
    },
    [hotkeys, quantityMode, tempQuantity, onQuantityUpdate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
};

export const HotkeysHelper: React.FC<HotkeysHelperProps> = () => {
  const [isVisible, setIsVisible] = useState(true);
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <>
      {isVisible ? (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg text-sm opacity-90 transition-transform transform animate-fade-in">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Klavye Kısayolları</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-gray-200 focus:outline-none transition"
            >
              X
            </button>
          </div>
          <ul className="space-y-1">
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">{modKey}+N</kbd>{" "}
              Yeni Satış
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">{modKey}+P</kbd>{" "}
              Ödeme
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">ESC</kbd>{" "}
              İptal/Kapat
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">Enter</kbd>{" "}
              Barkod Ara
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">{modKey}+K</kbd>{" "}
              Ürün Ara
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">{modKey}+T</kbd>{" "}
              Yeni Sekme
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">{modKey}+W</kbd>{" "}
              Sekme Kapat
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">
                {modKey}+Tab
              </kbd>{" "}
              Sekme Değiştir
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">* + sayı</kbd>{" "}
              Hızlı Miktar
            </li>
            <li>
              <kbd className="bg-gray-700 px-2 py-0.5 rounded">{modKey}+/</kbd>{" "}
              Yardım
            </li>
          </ul>
        </div>
      ) : (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 right-4 bg-gray-700 text-white p-2 rounded-full shadow-lg focus:outline-none hover:bg-gray-600 transition-transform transform animate-fade-in"
          title="Kısayol Bilgisi"
        >
          i
        </button>
      )}
    </>
  );
};
