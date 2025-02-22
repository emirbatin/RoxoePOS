// components/HotkeySettings.tsx
import React, { useState, useEffect } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import { useAlert } from "../components/AlertProvider";

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

const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const modKey = isMac ? "⌘" : "Ctrl";

const defaultHotkeys: CustomHotkeySettings[] = [
  {
    id: "new_sale",
    description: "Yeni Satış",
    defaultKey: "N",
    defaultModifier: true,
    currentKey: "N",
    currentModifier: true,
  },
  {
    id: "payment",
    description: "Ödeme Yap",
    defaultKey: "P",
    defaultModifier: true,
    currentKey: "P",
    currentModifier: true,
  },
  {
    id: "cancel",
    description: "İptal/Kapat",
    defaultKey: "Escape",
    defaultModifier: false,
    currentKey: "Escape",
    currentModifier: false,
  },
  {
    id: "search_focus",
    description: "Ürün Ara",
    defaultKey: "K",
    defaultModifier: true,
    currentKey: "K",
    currentModifier: true,
  },
  {
    id: "new_tab",
    description: "Yeni Sekme",
    defaultKey: "T",
    defaultModifier: true,
    currentKey: "T",
    currentModifier: true,
  },
  {
    id: "close_tab",
    description: "Sekme Kapat",
    defaultKey: "W",
    defaultModifier: true,
    currentKey: "W",
    currentModifier: true,
  },
  {
    id: "switch_tab",
    description: "Sekme Değiştir",
    defaultKey: "Tab",
    defaultModifier: true,
    currentKey: "Tab",
    currentModifier: true,
  },
  {
    id: "toggle_help",
    description: "Yardımı Göster/Gizle",
    defaultKey: "/",
    defaultModifier: true,
    currentKey: "/",
    currentModifier: true,
  },
];

const defaultSpecialHotkeys: SpecialHotkeySettings[] = [
  {
    id: "star_mode",
    description: "Hızlı Miktar Girişi",
    type: "quantity",
    defaultTrigger: "*",
    currentTrigger: "*",
    defaultTerminator: "Enter",
    currentTerminator: "Enter",
    isEditable: true,
  },
  {
    id: "quick_quantity",
    description: "Tek Tuşla Miktar",
    type: "numpad",
    defaultTrigger: "0-9",
    currentTrigger: "0-9",
    isEditable: false,
  },
];

interface Props {
  onSave?: (
    hotkeys: CustomHotkeySettings[],
    specialHotkeys: SpecialHotkeySettings[]
  ) => void;
}

const HotkeySettings: React.FC<Props> = ({ onSave }) => {
  const { showError, showSuccess, confirm } = useAlert();

  // Load saved settings or use defaults
  const [hotkeys, setHotkeys] = useState<CustomHotkeySettings[]>(() => {
    try {
      const saved = localStorage.getItem("hotkeySettings");
      return saved ? JSON.parse(saved) : defaultHotkeys;
    } catch {
      return defaultHotkeys;
    }
  });

  const [specialHotkeys, setSpecialHotkeys] = useState<SpecialHotkeySettings[]>(
    () => {
      try {
        const saved = localStorage.getItem("specialHotkeySettings");
        return saved ? JSON.parse(saved) : defaultSpecialHotkeys;
      } catch {
        return defaultSpecialHotkeys;
      }
    }
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSpecialId, setEditingSpecialId] = useState<string | null>(null);
  const [listenForKey, setListenForKey] = useState(false);

  // Handle key events for regular hotkeys
  useEffect(() => {
    if (!listenForKey || !editingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      // Ignore standalone modifier keys
      if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) {
        return;
      }

      // Check for conflicts with both normal and special hotkeys
      const normalConflict = hotkeys.find(
        (h) =>
          h.id !== editingId &&
          h.currentKey.toLowerCase() === e.key.toLowerCase() &&
          h.currentModifier === (isMac ? e.metaKey : e.ctrlKey)
      );

      const specialConflict = specialHotkeys.find(
        (h) => h.currentTrigger.toLowerCase() === e.key.toLowerCase()
      );

      if (normalConflict || specialConflict) {
        showError(
          `Bu tuş "${
            normalConflict?.description || specialConflict?.description
          }" için zaten kullanılıyor`
        );
        return;
      }

      // Update hotkey
      setHotkeys((prev) =>
        prev.map((h) =>
          h.id === editingId
            ? {
                ...h,
                currentKey: e.key,
                currentModifier: isMac ? e.metaKey : e.ctrlKey,
              }
            : h
        )
      );

      setListenForKey(false);
      setEditingId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [listenForKey, editingId, hotkeys, specialHotkeys, showError]);

  // Handle key events for special hotkeys
  useEffect(() => {
    if (!listenForKey || !editingSpecialId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) {
        return;
      }

      // Check for conflicts
      const normalConflict = hotkeys.find(
        (h) =>
          h.currentKey.toLowerCase() === e.key.toLowerCase() &&
          h.currentModifier === (isMac ? e.metaKey : e.ctrlKey)
      );

      const specialConflict = specialHotkeys.find(
        (h) =>
          h.id !== editingSpecialId &&
          h.currentTrigger.toLowerCase() === e.key.toLowerCase()
      );

      if (normalConflict || specialConflict) {
        showError(
          `Bu tuş "${
            normalConflict?.description || specialConflict?.description
          }" için zaten kullanılıyor`
        );
        return;
      }

      // Update special hotkey
      setSpecialHotkeys((prev) =>
        prev.map((h) =>
          h.id === editingSpecialId ? { ...h, currentTrigger: e.key } : h
        )
      );

      setListenForKey(false);
      setEditingSpecialId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [listenForKey, editingSpecialId, hotkeys, specialHotkeys, showError]);

  const startEditing = (id: string) => {
    setEditingId(id);
    setEditingSpecialId(null);
    setListenForKey(true);
  };

  const startEditingSpecial = (id: string) => {
    setEditingSpecialId(id);
    setEditingId(null);
    setListenForKey(true);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingSpecialId(null);
    setListenForKey(false);
  };

  const resetToDefaults = async () => {
    const confirmed = await confirm(
      "Tüm kısayolları varsayılan değerlerine döndürmek istediğinize emin misiniz?"
    );

    if (confirmed) {
      setHotkeys(defaultHotkeys);
      setSpecialHotkeys(defaultSpecialHotkeys);
      localStorage.setItem("hotkeySettings", JSON.stringify(defaultHotkeys));
      localStorage.setItem(
        "specialHotkeySettings",
        JSON.stringify(defaultSpecialHotkeys)
      );
      onSave?.(defaultHotkeys, defaultSpecialHotkeys);
      showSuccess("Kısayollar varsayılan değerlerine döndürüldü");
    }
  };

  const saveChanges = () => {
    localStorage.setItem("hotkeySettings", JSON.stringify(hotkeys));
    localStorage.setItem(
      "specialHotkeySettings",
      JSON.stringify(specialHotkeys)
    );
    onSave?.(hotkeys, specialHotkeys);
    showSuccess("Kısayollar başarıyla kaydedildi");
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-2 mb-6">
        <Keyboard className="text-primary-600" size={24} />
        <h2 className="text-lg font-semibold">Klavye Kısayolları</h2>
      </div>

      {/* Normal Hotkeys Section */}
      <div className="space-y-4 mb-8">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          Genel Kısayollar
        </h3>
        {hotkeys.map((hotkey) => (
          <div
            key={hotkey.id}
            className={`flex items-center justify-between py-2 border-b transition-colors ${
              editingId === hotkey.id ? "bg-gray-50" : ""
            }`}
          >
            <div>
              <div className="font-medium">{hotkey.description}</div>
              <div className="text-sm text-gray-500">
                Varsayılan: {hotkey.defaultModifier ? modKey + " + " : ""}
                {hotkey.defaultKey}
              </div>
            </div>

            {editingId === hotkey.id ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-gray-100 rounded text-sm min-w-[120px] text-center">
                  {listenForKey
                    ? "Tuş bekliyor..."
                    : `${hotkey.currentModifier ? modKey + " + " : ""}${
                        hotkey.currentKey
                      }`}
                </div>
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  İptal
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-gray-100 rounded text-sm">
                  {hotkey.currentModifier ? modKey + " + " : ""}
                  {hotkey.currentKey}
                </div>
                <button
                  onClick={() => startEditing(hotkey.id)}
                  className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Değiştir
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Special Hotkeys Section */}
      <div className="space-y-4 mb-8">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          Özel Kısayollar
        </h3>
        {specialHotkeys.map((hotkey) => (
          <div
            key={hotkey.id}
            className={`flex items-center justify-between py-2 border-b transition-colors ${
              editingSpecialId === hotkey.id ? "bg-gray-50" : ""
            } ${!hotkey.isEditable ? "opacity-50" : ""}`}
          >
            <div>
              <div className="font-medium">{hotkey.description}</div>
              <div className="text-sm text-gray-500">
                Varsayılan:
                {hotkey.type === "quantity"
                  ? ` ${hotkey.defaultTrigger} + sayı + ${hotkey.defaultTerminator}`
                  : ` ${hotkey.defaultTrigger}`}
              </div>
            </div>

            {editingSpecialId === hotkey.id ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-gray-100 rounded text-sm min-w-[120px] text-center">
                  {listenForKey
                    ? "Tuş bekliyor..."
                    : hotkey.type === "quantity"
                    ? `${hotkey.currentTrigger} + sayı + ${hotkey.currentTerminator}`
                    : hotkey.currentTrigger}
                </div>
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  İptal
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-gray-100 rounded text-sm">
                  {hotkey.type === "quantity"
                    ? `${hotkey.currentTrigger} + sayı + ${hotkey.currentTerminator}`
                    : hotkey.currentTrigger}
                </div>
                {hotkey.isEditable && (
                  <button
                    onClick={() => startEditingSpecial(hotkey.id)}
                    className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    Değiştir
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="text-sm text-gray-500 mt-2 p-4 bg-gray-50 rounded-lg">
          <p>
            <strong>Not:</strong> "Tek Tuşla Miktar" özelliği güvenlik nedeniyle
            değiştirilemez. Bu özellik her zaman 0-9 tuşlarıyla çalışır.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between mt-6 pt-4 border-t">
        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          <RotateCcw size={16} />
          Varsayılanlara Dön
        </button>
        <button
          onClick={saveChanges}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Değişiklikleri Kaydet
        </button>
      </div>

      {/* Helper Text */}
      <div className="mt-6 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm">
        <ul className="space-y-2">
          <li>
            • Kısayolu değiştirmek için "Değiştir" butonuna tıklayın ve yeni tuş
            kombinasyonunu girin.
          </li>
          <li>
            • {modKey} tuşunu basılı tutarak bir tuşa basarsanız, kısayol{" "}
            {modKey} ile birlikte çalışacaktır.
          </li>
          <li>• Bir kısayol diğer kısayollarla çakışamaz.</li>
          <li>
            • Hızlı miktar girişi için kullanılan tuş, Enter tuşuyla birlikte
            çalışır.
          </li>
          <li>• İptal etmek için ESC tuşunu kullanabilirsiniz.</li>
        </ul>
      </div>
    </div>
  );
};

export default HotkeySettings;
