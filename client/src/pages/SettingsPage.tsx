// pages/SettingsPage.tsx
import React, { useEffect, useState } from "react";
import {
  Printer,
  Save,
  Barcode,
  Building,
  Key,
  Check,
  RefreshCw,
} from "lucide-react";
import { POSConfig, SerialOptions } from "../types/pos";
import { BarcodeConfig } from "../types/barcode";
import { ReceiptConfig } from "../types/receipt";
import Button from "../components/ui/Button";
import { useAlert } from "../components/AlertProvider";
import HotkeySettings from "../components/HotkeySettings";
import LicenseCard from "../components/LicenseCard";

interface LicenseInfo {
  maskedLicense: string;
  expiresAt: string | null;
  isActive: boolean;
  daysRemaining: number | null;
  isExpired: boolean;
  isExpiring: boolean;
}

interface SettingsTab {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const SettingsPage: React.FC = () => {
  const { showSuccess, showError } = useAlert();
  const [activeTab, setActiveTab] = useState<string>("pos");
  const [saveStatus, setSaveStatus] = useState<{
    status: "idle" | "saving" | "saved" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  // Settings tabs
  const tabs: SettingsTab[] = [
    { id: "pos", title: "POS Cihazı", icon: <Printer size={20} /> },
    { id: "barcode", title: "Barkod Okuyucu", icon: <Barcode size={20} /> },
    { id: "receipt", title: "Fiş ve İşletme", icon: <Building size={20} /> },
    { id: "hotkeys", title: "Kısayollar", icon: <Key size={20} /> },
    { id: "license", title: "Lisans", icon: <Check size={20} /> },
  ];

  // 1) POS Config
  const [posConfig, setPosConfig] = useState<POSConfig>({
    type: "Ingenico",
    baudRate: 9600,
    protocol: "OPOS",
    commandSet: {
      payment: "0x02payment0x03",
      cancel: "0x02cancel0x03",
      status: "0x02status0x03",
    },
    manualMode: false, // Manuel mod
  });

  // 2) Serial Options (Port ayarları)
  const [serialOptions, setSerialOptions] = useState<SerialOptions>({
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none",
  });

  // 3) Barkod Okuyucu Ayarları
  const [barcodeConfig, setBarcodeConfig] = useState<BarcodeConfig>({
    type: "USB HID",
    baudRate: 9600,
    enabled: true,
    prefix: "",
    suffix: "\n",
  });

  // 4) Bağlantı Durumu
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "unknown"
  >("unknown");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // 5) Fiş Ayarları
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>({
    storeName: "",
    legalName: "",
    address: ["", ""],
    phone: "",
    taxOffice: "",
    taxNumber: "",
    mersisNo: "",
    footer: {
      message: "Bizi tercih ettiğiniz için teşekkür ederiz",
      returnPolicy: "Ürün iade ve değişimlerinde bu fiş ve ambalaj gereklidir",
    },
  });

  // Lisans Ayarları
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<{
    loading: boolean;
    error: string | null;
  }>({ loading: false, error: null });

  // 6) Load Settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedPosConfig = localStorage.getItem("posConfig");
        const savedSerialOptions = localStorage.getItem("serialOptions");
        const savedBarcodeConfig = localStorage.getItem("barcodeConfig");
        const savedReceiptConfig = localStorage.getItem("receiptConfig");

        if (savedPosConfig) setPosConfig(JSON.parse(savedPosConfig));
        if (savedSerialOptions)
          setSerialOptions(JSON.parse(savedSerialOptions));
        if (savedBarcodeConfig)
          setBarcodeConfig(JSON.parse(savedBarcodeConfig));
        if (savedReceiptConfig)
          setReceiptConfig(JSON.parse(savedReceiptConfig));
      } catch (err) {
        console.error("Ayarlar yüklenirken hata:", err);
      }
    };
    loadSettings();

    // Burada lisansı da kontrol et
    checkLicense();
  }, []);

  // Auto-save settings when changed
  const saveSettings = (
    updatedConfig?: {
      posConfig?: Partial<POSConfig>;
      serialOptions?: Partial<SerialOptions>;
      barcodeConfig?: Partial<BarcodeConfig>;
      receiptConfig?: Partial<ReceiptConfig>;
    },
    callback?: () => void
  ) => {
    setSaveStatus({ status: "saving", message: "Kaydediliyor..." });

    setTimeout(() => {
      try {
        // Eğer güncellenmiş bir config değeri varsa onu kullan
        if (updatedConfig?.posConfig) {
          // Mevcut state ile birleştir
          const mergedPosConfig = { ...posConfig, ...updatedConfig.posConfig };
          // Güncelle
          localStorage.setItem("posConfig", JSON.stringify(mergedPosConfig));
          // State'i güncelle
          setPosConfig(mergedPosConfig);
        } else {
          // Değişiklik yoksa mevcut state'i kaydet
          localStorage.setItem("posConfig", JSON.stringify(posConfig));
        }

        // Diğer ayarlar için de aynı mantık
        if (updatedConfig?.serialOptions) {
          const mergedSerialOptions = {
            ...serialOptions,
            ...updatedConfig.serialOptions,
          };
          localStorage.setItem(
            "serialOptions",
            JSON.stringify(mergedSerialOptions)
          );
          setSerialOptions(mergedSerialOptions);
        } else {
          localStorage.setItem("serialOptions", JSON.stringify(serialOptions));
        }

        if (updatedConfig?.barcodeConfig) {
          const mergedBarcodeConfig = {
            ...barcodeConfig,
            ...updatedConfig.barcodeConfig,
          };
          localStorage.setItem(
            "barcodeConfig",
            JSON.stringify(mergedBarcodeConfig)
          );
          setBarcodeConfig(mergedBarcodeConfig);
        } else {
          localStorage.setItem("barcodeConfig", JSON.stringify(barcodeConfig));
        }

        if (updatedConfig?.receiptConfig) {
          const mergedReceiptConfig = {
            ...receiptConfig,
            ...updatedConfig.receiptConfig,
          };
          localStorage.setItem(
            "receiptConfig",
            JSON.stringify(mergedReceiptConfig)
          );
          setReceiptConfig(mergedReceiptConfig);
        } else {
          localStorage.setItem("receiptConfig", JSON.stringify(receiptConfig));
        }

        setSaveStatus({ status: "saved", message: "Değişiklikler kaydedildi" });

        if (callback) callback();

        // 3 saniye sonra mesajı kaldır
        setTimeout(() => {
          setSaveStatus({ status: "idle", message: "" });
        }, 3000);
      } catch (err: any) {
        setSaveStatus({
          status: "error",
          message: "Kaydetme hatası: " + err.message,
        });
        showError("Ayarlar kaydedilirken hata oluştu: " + err.message);
      }
    }, 100);
  };

  // Lisans kontrolü için eklenen fonksiyon:
  const checkLicense = async () => {
    try {
      const result = await window.ipcRenderer.invoke("get-license-info");
      if (result.exists) {
        setLicenseInfo({
          maskedLicense: result.maskedLicense,
          expiresAt: result.expiresAt, // API'den dönen geçerlilik tarihi veya null
          isActive: !result.isExpired,
          daysRemaining: result.expiresAt ? result.daysLeft : null,
          isExpired: result.isExpired,
          isExpiring: result.isExpiring,
        });
      } else {
        setLicenseInfo(null);
      }
    } catch (error) {
      console.error("Lisans bilgisi alınamadı:", error);
      setLicenseInfo(null);
    }
  };

  // Lisans yenileme/aktivasyon fonksiyonu:
  const renewLicense = async () => {
    if (!newLicenseKey) {
      showError("Lütfen lisans anahtarı girin");
      return;
    }
    setLicenseStatus({ loading: true, error: null });
    try {
      const result = await window.ipcRenderer.invoke(
        "activate-license",
        newLicenseKey
      );
      if (result.success) {
        showSuccess("Lisans başarıyla yenilendi");
        checkLicense();
        setNewLicenseKey("");
        setLicenseStatus({ loading: false, error: null });
      } else {
        setLicenseStatus({
          loading: false,
          error: result.error || "Lisans yenileme başarısız oldu",
        });
      }
    } catch (error) {
      setLicenseStatus({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Lisans yenileme sırasında hata oluştu",
      });
    }
  };

  // 7) POS Bağlantı Testi
  const testConnection = async () => {
    if (posConfig.manualMode) {
      setConnectionStatus("connected");
      setLastChecked(new Date());
      showSuccess("Manuel mod aktif - Bağlantı testi atlandı!");
      return;
    }

    try {
      // Web Serial API
      const port = await window.serialAPI.requestPort();
      await port.open(serialOptions);

      // Status komutu gönder
      const writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(posConfig.commandSet.status));
      writer.releaseLock();

      // Yanıt oku
      const reader = port.readable.getReader();
      const { value } = await reader.read();
      reader.releaseLock();

      if (value) {
        setConnectionStatus("connected");
        setLastChecked(new Date());
        showSuccess("POS bağlantısı başarılı ve cihaz yanıt verdi!");
      }

      await port.close();
    } catch (err: any) {
      setConnectionStatus("disconnected");
      setLastChecked(new Date());
      showError("Bağlantı hatası: " + err.message);
    }
  };

  // Render appropriate content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "pos":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold">POS Cihazı Ayarları</h2>
              <div className="flex items-center gap-2">
                {connectionStatus === "connected" && (
                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>{" "}
                    Bağlı
                  </span>
                )}
                {connectionStatus === "disconnected" && (
                  <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>{" "}
                    Bağlantı Yok
                  </span>
                )}
              </div>
            </div>

            {/* Manuel Mod Toggle */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Manuel Mod</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    POS cihazı olmadan çalışmayı etkinleştir
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={posConfig.manualMode}
                    onChange={(e) => {
                      const newManualMode = e.target.checked;
                      // Güncellenmiş değeri direkt olarak saveSettings'e gönder
                      saveSettings({
                        posConfig: { manualMode: newManualMode },
                      });
                      // State güncellemesi saveSettings içinde yapılıyor
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div
              className={`space-y-6 ${
                posConfig.manualMode && "opacity-80 pointer-events-none"
              }`}
            >
              {/* POS Marka ve Bağlantı Ayarları */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-medium text-gray-900 mb-4">
                  Cihaz Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      POS Markası
                    </label>
                    <input
                      type="text"
                      value={posConfig.type}
                      onChange={(e) => {
                        setPosConfig({ ...posConfig, type: e.target.value });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Baud Rate
                    </label>
                    <select
                      value={serialOptions.baudRate}
                      onChange={(e) => {
                        setSerialOptions({
                          ...serialOptions,
                          baudRate: Number(e.target.value),
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="9600">9600</option>
                      <option value="19200">19200</option>
                      <option value="38400">38400</option>
                      <option value="115200">115200</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Bits
                    </label>
                    <select
                      value={serialOptions.dataBits}
                      onChange={(e) => {
                        setSerialOptions({
                          ...serialOptions,
                          dataBits: Number(e.target.value),
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="7">7</option>
                      <option value="8">8</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stop Bits
                    </label>
                    <select
                      value={serialOptions.stopBits}
                      onChange={(e) => {
                        setSerialOptions({
                          ...serialOptions,
                          stopBits: Number(e.target.value),
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parity
                    </label>
                    <select
                      value={serialOptions.parity}
                      onChange={(e) => {
                        setSerialOptions({
                          ...serialOptions,
                          parity: e.target.value as "none" | "even" | "odd",
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="none">None</option>
                      <option value="even">Even</option>
                      <option value="odd">Odd</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Flow Control
                    </label>
                    <select
                      value={serialOptions.flowControl}
                      onChange={(e) => {
                        setSerialOptions({
                          ...serialOptions,
                          flowControl: e.target.value as "none" | "hardware",
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="none">None</option>
                      <option value="hardware">Hardware</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={testConnection}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Printer size={18} />
                    Bağlantıyı Test Et
                  </button>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 bg-blue-50 p-4 rounded-xl">
              <p>
                ℹ️ Cihaz ayarları için genellikle POS cihazınızın
                dokümantasyonuna bakmanız gerekir. Eğer bir POS cihazınız yoksa,
                Manuel Modu etkinleştirerek test işlemleri yapabilirsiniz.
              </p>
            </div>
          </div>
        );
      case "barcode":
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Barkod Okuyucu Ayarları</h2>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-medium text-gray-900">
                    Barkod Okuyucu Durumu
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Barkod okuyucuyu etkinleştir veya devre dışı bırak
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={barcodeConfig.enabled}
                    onChange={(e) => {
                      setBarcodeConfig({
                        ...barcodeConfig,
                        enabled: e.target.checked,
                      });
                      saveSettings();
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div
                className={
                  barcodeConfig.enabled ? "" : "opacity-50 pointer-events-none"
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Okuyucu Tipi
                    </label>
                    <select
                      value={barcodeConfig.type}
                      onChange={(e) => {
                        setBarcodeConfig({
                          ...barcodeConfig,
                          type: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="USB HID">USB (HID)</option>
                      <option value="USB COM">USB (COM Port)</option>
                      <option value="PS/2">PS/2</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Önek (Prefix)
                    </label>
                    <input
                      type="text"
                      value={barcodeConfig.prefix}
                      onChange={(e) => {
                        setBarcodeConfig({
                          ...barcodeConfig,
                          prefix: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Opsiyonel"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sonek (Suffix)
                    </label>
                    <input
                      type="text"
                      value={barcodeConfig.suffix}
                      onChange={(e) => {
                        setBarcodeConfig({
                          ...barcodeConfig,
                          suffix: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Varsayılan: \n (Enter)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 bg-blue-50 p-4 rounded-xl">
              <p>
                ℹ️ Çoğu barkod okuyucu için herhangi bir ayarlama yapmanız
                gerekmez. Genellikle barkod okuyucular bağlandıktan sonra
                otomatik olarak çalışırlar. Eğer özel bir okuyucu
                kullanıyorsanız, önek (prefix) ve sonek (suffix) değerlerini
                ayarlayabilirsiniz.
              </p>
            </div>
          </div>
        );
      case "receipt":
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">İşletme ve Fiş Ayarları</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-medium text-gray-900 mb-4">
                  İşletme Bilgileri
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Market Adı
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.storeName}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          storeName: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: MARKET XYZ"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ticari Unvan
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.legalName}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          legalName: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: XYZ GIDA SAN. VE TİC. LTD. ŞTİ."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adres Satır 1
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.address[0]}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          address: [e.target.value, receiptConfig.address[1]],
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: Fatih Mah. Kurtuluş Cad."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adres Satır 2
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.address[1]}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          address: [receiptConfig.address[0], e.target.value],
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: No:123 Merkez/İstanbul"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefon
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.phone}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          phone: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: (212) 123 45 67"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-medium text-gray-900 mb-4">
                  Vergi ve Yasal Bilgiler
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vergi Dairesi
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.taxOffice}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          taxOffice: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: Fatih VD."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vergi No
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.taxNumber}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          taxNumber: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: 1234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mersis No
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.mersisNo}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          mersisNo: e.target.value,
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: 0123456789"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teşekkür Mesajı
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.footer.message}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          footer: {
                            ...receiptConfig.footer,
                            message: e.target.value,
                          },
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: Bizi tercih ettiğiniz için teşekkür ederiz"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      İade Politikası
                    </label>
                    <input
                      type="text"
                      value={receiptConfig.footer.returnPolicy}
                      onChange={(e) => {
                        setReceiptConfig({
                          ...receiptConfig,
                          footer: {
                            ...receiptConfig.footer,
                            returnPolicy: e.target.value,
                          },
                        });
                        saveSettings();
                      }}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Örn: Ürün iade ve değişimlerinde bu fiş ve ambalaj gereklidir"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 bg-blue-50 p-4 rounded-xl">
              <p>
                ℹ️ Bu bilgiler, yazdırılan fişlerde görünecektir. Bu alanları
                doğru bir şekilde doldurmanız önemlidir. İşletme bilgileriniz
                değişirse buradan güncelleyebilirsiniz.
              </p>
            </div>
          </div>
        );
      case "hotkeys":
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Klavye Kısayolları</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <HotkeySettings
                onSave={(newHotkeys, newSpecialHotkeys) => {
                  // Kısayollar zaten HotkeySettings içinde kaydediliyor
                  window.dispatchEvent(
                    new CustomEvent("hotkeysUpdated", {
                      detail: {
                        hotkeys: newHotkeys,
                        specialHotkeys: newSpecialHotkeys,
                      },
                    })
                  );
                  showSuccess("Kısayollar başarıyla kaydedildi");
                }}
              />
            </div>
          </div>
        );
      case "license":
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Lisans Yönetimi</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6">
              {licenseInfo ? (
                <LicenseCard
                  licenseInfo={{
                    maskedLicense: licenseInfo.maskedLicense,
                    expiresAt: licenseInfo.expiresAt,
                    daysLeft: licenseInfo.daysRemaining,
                    isExpired: licenseInfo.isExpired,
                    isExpiring: licenseInfo.isExpiring,
                    isActive: licenseInfo.isActive,
                  }}
                  onRenew={renewLicense}
                  renewalLoading={licenseStatus.loading}
                  renewalError={licenseStatus.error}
                />
              ) : (
                <div>
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                    <p className="text-red-700">
                      Lisans bilgisi bulunamadı. Lisansınızı aktifleştirmek için
                      aşağıdaki alana lisans anahtarınızı girin.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <input
                      type="text"
                      value={newLicenseKey}
                      onChange={(e) =>
                        setNewLicenseKey(e.target.value.toUpperCase())
                      }
                      placeholder="Lisans anahtarınızı girin"
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      disabled={licenseStatus.loading}
                    />
                    {licenseStatus.error && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                        <p className="text-red-700">{licenseStatus.error}</p>
                      </div>
                    )}
                    <button
                      onClick={renewLicense}
                      className="flex items-center gap-2 w-full justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300"
                      disabled={licenseStatus.loading}
                    >
                      {licenseStatus.loading ? (
                        <>
                          <span className="rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Aktifleştiriliyor...
                        </>
                      ) : (
                        <>
                          <Key size={18} />
                          Lisansı Aktifleştir
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 text-sm text-gray-500 bg-blue-50 p-4 rounded-lg">
                <p>
                  ℹ️ Lisansınız, uygulamamızı yasal olarak kullanmanız için
                  gereklidir. Lisansınızın süresi dolduğunda veya lisans
                  bilgilerinizde bir değişiklik olduğunda buradan
                  güncelleyebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Ayarlar</h1>

        {/* Auto-save indicator */}
        {saveStatus.status !== "idle" && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              saveStatus.status === "saving"
                ? "bg-blue-50 text-blue-600"
                : saveStatus.status === "saved"
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            {saveStatus.status === "saving" && (
              <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent"></div>
            )}
            {saveStatus.status === "saved" && <Check size={16} />}
            {saveStatus.status === "error" && (
              <span className="text-red-600">⚠️</span>
            )}
            {saveStatus.message}
          </div>
        )}
      </header>

      <main className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-2">
            <ul className="space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left ${
                      activeTab === tab.id
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Content */}
        <div className="md:col-span-3">{renderTabContent()}</div>
      </main>
    </div>
  );
};

export default SettingsPage;
