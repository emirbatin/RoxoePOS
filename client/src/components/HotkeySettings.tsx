// components/HotkeySettings.tsx
import React, { useState, useEffect, useRef } from "react";
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

// Default settings dışarı alındı
const defaultHotkeys: CustomHotkeySettings[] = [
  {
    id: "new_sale",
    description: "Yeni Satış",
    defaultKey: "N",
    defaultModifier: true,
    currentKey: "N",
    currentModifier: true,
  },
  // Diğer kısayollar...
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
  // Diğer özel kısayollar...
];

interface Props {
  onSave?: (
    hotkeys: CustomHotkeySettings[],
    specialHotkeys: SpecialHotkeySettings[]
  ) => void;
}

const HotkeySettings: React.FC<Props> = ({ onSave }) => {
  const { showError, showSuccess, confirm } = useAlert();

  // State'lere referanslar ekle
  const prevHotkeysRef = useRef<string>("");
  const prevSpecialHotkeysRef = useRef<string>("");

  // Load saved settings or use defaults
  const [hotkeys, setHotkeys] = useState<CustomHotkeySettings[]>(() => {
    try {
      const saved = localStorage.getItem("hotkeySettings");
      const parsed = saved ? JSON.parse(saved) : defaultHotkeys;
      // İlk değeri referansa kaydet
      prevHotkeysRef.current = JSON.stringify(parsed);
      return parsed;
    } catch {
      return defaultHotkeys;
    }
  });

  const [specialHotkeys, setSpecialHotkeys] = useState<SpecialHotkeySettings[]>(
    () => {
      try {
        const saved = localStorage.getItem("specialHotkeySettings");
        const parsed = saved ? JSON.parse(saved) : defaultSpecialHotkeys;
        // İlk değeri referansa kaydet
        prevSpecialHotkeysRef.current = JSON.stringify(parsed);
        return parsed;
      } catch {
        return defaultSpecialHotkeys;
      }
    }
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSpecialId, setEditingSpecialId] = useState<string | null>(null);
  const [listenForKey, setListenForKey] = useState(false);

  // Değişiklikleri algılama ve kaydetme için useEffect
  useEffect(() => {
    // Düzenleme süreci devam ediyorsa kaydetme
    if (editingId || editingSpecialId || listenForKey) {
      return;
    }

    // Mevcut değerlerin string temsilini alın
    const currentHotkeysStr = JSON.stringify(hotkeys);
    const currentSpecialHotkeysStr = JSON.stringify(specialHotkeys);

    // Değişiklik var mı kontrol edin
    const hotkeysChanged = currentHotkeysStr !== prevHotkeysRef.current;
    const specialHotkeysChanged =
      currentSpecialHotkeysStr !== prevSpecialHotkeysRef.current;

    // Değişiklik yoksa işlem yapma
    if (!hotkeysChanged && !specialHotkeysChanged) {
      return;
    }

    // Değişiklik varsa kaydedin
    if (hotkeysChanged) {
      localStorage.setItem("hotkeySettings", currentHotkeysStr);
      prevHotkeysRef.current = currentHotkeysStr;
    }

    if (specialHotkeysChanged) {
      localStorage.setItem("specialHotkeySettings", currentSpecialHotkeysStr);
      prevSpecialHotkeysRef.current = currentSpecialHotkeysStr;
    }

    // Olayı tetikle
    window.dispatchEvent(new Event("hotkeySettingsChanged"));

    // Parent component'i bilgilendir (sadece gerçek değişiklikler olduğunda)
    if (onSave && (hotkeysChanged || specialHotkeysChanged)) {
      onSave(hotkeys, specialHotkeys);
    }
  }, [
    hotkeys,
    specialHotkeys,
    editingId,
    editingSpecialId,
    listenForKey,
    onSave,
  ]);

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
  }, [
    listenForKey,
    editingId,
    hotkeys,
    specialHotkeys,
    showError,
    showSuccess,
  ]);

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

      // Değişiklik bildirimi
      showSuccess("Özel kısayol güncellendi");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    listenForKey,
    editingSpecialId,
    hotkeys,
    specialHotkeys,
    showError,
    showSuccess,
  ]);

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

      // Değişiklik bildirimi
      showSuccess("Kısayollar varsayılan değerlerine döndürüldü");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-2 mb-6">
        <Keyboard className="text-indigo-600" size={24} />
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
                  className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
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
                    className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
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

      {/* Only Reset Button - No Save Button */}
      <div className="flex justify-between mt-6 pt-4 border-t">
        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          <RotateCcw size={16} />
          Varsayılanlara Dön
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
          <li>
            •{" "}
            <strong>
              Değişiklikler otomatik olarak kaydedilir ve anında uygulanır.
            </strong>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default HotkeySettings;
