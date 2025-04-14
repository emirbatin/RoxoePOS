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
  Upload,
  Download,
  Clock,
  Database,
  Info,
  Mail,
} from "lucide-react";
import { POSConfig, SerialOptions } from "../types/pos";
import { BarcodeConfig } from "../types/barcode";
import { ReceiptConfig } from "../types/receipt";
import Button from "../components/ui/Button";
import { useAlert } from "../components/AlertProvider";
import HotkeySettings from "../components/HotkeySettings";
import LicenseCard from "../components/LicenseCard";
import Icon from "../assets/icon.png";

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

interface BackupHistoryItem {
  id: string;
  filename: string;
  description: string;
  createdAt: string;
  databases: string[];
  totalRecords: number;
}

interface BackupProgress {
  stage: string;
  percent: number;
}

interface BackupScheduleConfig {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  lastBackup: string | null;
}

const SettingsPage: React.FC = () => {
  const [appVersion, setAppVersion] = useState<string>("0.0.0");
  const { showSuccess, showError } = useAlert();
  const [activeTab, setActiveTab] = useState<string>("pos");
  const [saveStatus, setSaveStatus] = useState<{
    status: "idle" | "saving" | "saved" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  // Yedekleme ile ilgili stateler
  const [backups, setBackups] = useState<BackupHistoryItem[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState<BackupProgress>({
    stage: "",
    percent: 0,
  });
  const [backupSchedule, setBackupSchedule] = useState<BackupScheduleConfig>({
    enabled: false,
    frequency: "daily",
    lastBackup: null,
  });

  // Settings tabs
  const tabs: SettingsTab[] = [
    { id: "pos", title: "POS Cihazı", icon: <Printer size={20} /> },
    { id: "barcode", title: "Barkod Okuyucu", icon: <Barcode size={20} /> },
    { id: "receipt", title: "Fiş ve İşletme", icon: <Building size={20} /> },
    { id: "backup", title: "Yedekleme", icon: <Database size={20} /> },
    { id: "hotkeys", title: "Kısayollar", icon: <Key size={20} /> },
    { id: "license", title: "Lisans", icon: <Check size={20} /> },
    { id: "about", title: "Hakkında", icon: <Info size={20} /> },
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

        // Yedekleme zamanlamasını yükle
        const savedBackupSchedule = localStorage.getItem("backup_schedule");
        if (savedBackupSchedule) {
          setBackupSchedule(JSON.parse(savedBackupSchedule));
        }
      } catch (err) {
        console.error("Ayarlar yüklenirken hata:", err);
      }
    };
    loadSettings();

    // Burada lisansı da kontrol et
    checkLicense();

    // Yedek geçmişini yükle
    loadBackupHistory();
  }, []);

  //Uygulama Versiyonu
  useEffect(() => {
    // Uygulama versiyonunu yükle
    const loadAppVersion = async () => {
      try {
        const version = await window.appInfo.getVersion();
        setAppVersion(version);
      } catch (error) {
        console.error("Versiyon bilgisi alınamadı:", error);
      }
    };

    loadAppVersion();
  }, []);

  // Yedekleme işlemleri için dinleyici ve temizleyici
  useEffect(() => {
    // Yedekleme ilerleme bildirimleri için dinleyici
    const handleBackupProgress = (data: { stage: string; percent: number }) => {
      setBackupProgress(data);
    };

    // Dinleyiciyi ekle
    window.backupAPI.onBackupProgress(handleBackupProgress);

    // Temizleme fonksiyonu
    return () => {
      window.backupAPI.offBackupProgress(handleBackupProgress);
    };
  }, []);

  // Yedek geçmişini yükle
  const loadBackupHistory = async () => {
    try {
      const history = await window.backupAPI.getBackupHistory();
      setBackups(history);
    } catch (error) {
      console.error("Yedek geçmişi yüklenemedi:", error);
    }
  };

  // Yeni yedek oluştur
  const handleCreateBackup = async () => {
    setBackupLoading(true);
    setBackupProgress({ stage: "Yedekleme başlatılıyor", percent: 0 });

    try {
      const result = await window.backupAPI.createBackup({
        description: "Manuel Yedekleme",
      });

      if (result.success) {
        showSuccess(`Yedekleme başarılı: ${result.filename}`);
        loadBackupHistory(); // Geçmişi yenile
      } else {
        showError(`Yedekleme hatası: ${result.error}`);
      }
    } catch (error) {
      showError(
        `Beklenmeyen hata: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setBackupLoading(false);
    }
  };

  // Yedeği geri yükle
  const handleRestoreBackup = async () => {
    try {
      setRestoreLoading(true);
      setBackupProgress({ stage: "Dosya seçiliyor", percent: 0 });

      // Dosyayı oku
      const { content } = await window.backupAPI.readBackupFile();

      setBackupProgress({ stage: "Geri yükleme başlatılıyor", percent: 10 });

      const result = await window.backupAPI.restoreBackup(content, {
        clearExisting: true,
      });

      if (result.success) {
        showSuccess("Geri yükleme başarılı! Sayfayı yenilemelisiniz.");
      } else {
        showError(`Geri yükleme hatası: ${result.error}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Dosya seçilmedi")) {
        // Kullanıcı iptal ettiğinde hata gösterme
        console.log("Kullanıcı dosya seçimini iptal etti");
      } else {
        showError(
          `Geri yükleme hatası: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } finally {
      setRestoreLoading(false);
    }
  };

  // Otomatik yedeklemeyi ayarla
  const setupAutoBackup = async (frequency: "daily" | "weekly" | "monthly") => {
    try {
      const result = await window.backupAPI.scheduleBackup(frequency);

      if (result) {
        setBackupSchedule({
          enabled: true,
          frequency,
          lastBackup: null,
        });
        localStorage.setItem(
          "backup_schedule",
          JSON.stringify({
            enabled: true,
            frequency,
            lastBackup: null,
          })
        );
        showSuccess(`Otomatik yedekleme ayarlandı: ${frequency}`);
      } else {
        showError("Otomatik yedekleme ayarlanamadı");
      }
    } catch (error) {
      showError(
        `Hata: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Otomatik yedeklemeyi devre dışı bırak
  const disableAutoBackup = async () => {
    try {
      const result = await window.backupAPI.disableScheduledBackup();

      if (result) {
        setBackupSchedule({
          enabled: false,
          frequency: backupSchedule.frequency,
          lastBackup: backupSchedule.lastBackup,
        });
        localStorage.setItem(
          "backup_schedule",
          JSON.stringify({
            enabled: false,
            frequency: backupSchedule.frequency,
            lastBackup: backupSchedule.lastBackup,
          })
        );
        showSuccess("Otomatik yedekleme devre dışı bırakıldı");
      } else {
        showError("Otomatik yedekleme devre dışı bırakılamadı");
      }
    } catch (error) {
      showError(
        `Hata: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

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
          <div>
            <div className="flex items-center justify-between">
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
              className={`space-y-3 ${
                posConfig.manualMode && "opacity-80 pointer-events-none"
              }`}
            >
              {/* POS Marka ve Bağlantı Ayarları */}
              <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
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
          <div className="space-y-3">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-3
              ">
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
          <div className="space-y-3">
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
      case "backup":
        return (
          <div className="space-y-3">
            {/* Yedekleme İşlemleri */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4">
                Manuel Yedekleme
              </h3>

              <div className="flex items-center gap-4 mb-5">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300"
                  onClick={handleCreateBackup}
                  disabled={backupLoading || restoreLoading}
                >
                  <Save size={18} />
                  {backupLoading ? "Yedekleniyor..." : "Yeni Yedek Oluştur"}
                </button>

                <button
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-300"
                  onClick={handleRestoreBackup}
                  disabled={backupLoading || restoreLoading}
                >
                  <Upload size={18} />
                  {restoreLoading
                    ? "Geri Yükleniyor..."
                    : "Yedekten Geri Yükle"}
                </button>
              </div>

              {/* İlerleme çubuğu - yedekleme/geri yükleme işlemi sürerken göster */}
              {(backupLoading || restoreLoading) && (
                <div className="mb-5">
                  <p className="text-sm text-gray-700 mb-1">
                    {backupProgress.stage} ({backupProgress.percent}%)
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full"
                      style={{ width: `${backupProgress.percent}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500 bg-blue-50 p-4 rounded-lg">
                <p>
                  ℹ️ Manuel yedekleme ile verilerinizin anlık bir kopyasını
                  oluşturabilirsiniz. Oluşturduğunuz yedekler, seçtiğiniz konuma
                  kaydedilir ve herhangi bir zamanda geri yüklenebilir.
                </p>
              </div>
            </div>

            {/* Otomatik Yedekleme */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4">
                Otomatik Yedekleme
              </h3>

              <div className="flex flex-wrap gap-3 mb-5">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  onClick={() => setupAutoBackup("daily")}
                >
                  <Clock size={18} />
                  Günlük
                </button>

                <button
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  onClick={() => setupAutoBackup("weekly")}
                >
                  <Clock size={18} />
                  Haftalık
                </button>

                <button
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  onClick={() => setupAutoBackup("monthly")}
                >
                  <Clock size={18} />
                  Aylık
                </button>

                <button
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  onClick={disableAutoBackup}
                >
                  <Clock size={18} />
                  Devre Dışı Bırak
                </button>
              </div>

              {/* Otomatik yedekleme durumu */}
              <div
                className={`p-4 rounded-lg ${
                  backupSchedule.enabled
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <h4 className="font-medium text-gray-900 mb-2">
                  Otomatik Yedekleme Durumu
                </h4>

                {backupSchedule.enabled ? (
                  <div className="text-sm text-gray-700">
                    <p className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      <strong>Aktif</strong> -{" "}
                      {backupSchedule.frequency === "daily"
                        ? "Günlük"
                        : backupSchedule.frequency === "weekly"
                        ? "Haftalık"
                        : "Aylık"}{" "}
                      yedekleme zamanlanmış
                    </p>
                    {backupSchedule.lastBackup && (
                      <p className="mt-1 ml-5">
                        Son yedekleme:{" "}
                        {new Date(backupSchedule.lastBackup).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                    <strong>Devre dışı</strong> - Otomatik yedekleme
                    ayarlanmamış
                  </p>
                )}
              </div>

              <div className="text-sm text-gray-500 bg-blue-50 p-4 rounded-lg mt-5">
                <p>
                  ℹ️ Otomatik yedekleme, verilerinizin belirli aralıklarla
                  yedeklenmesini sağlar. Böylece veri kaybı riskini en aza
                  indirebilirsiniz. Yedekler, belirlenen konuma otomatik olarak
                  kaydedilir.
                </p>
              </div>
            </div>

            {/* Yedek Geçmişi */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-900 mb-4">Yedek Geçmişi</h3>

              {backups.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tarih
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Açıklama
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Veritabanları
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kayıtlar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {backups.map((backup) => (
                        <tr key={backup.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                            {new Date(backup.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                            {backup.description}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                            {backup.databases?.join(", ")}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                            {backup.totalRecords}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-5 text-gray-500">
                  Henüz yedekleme yapılmamış
                </div>
              )}

              <div className="text-sm text-gray-500 bg-blue-50 p-4 rounded-lg mt-5">
                <p>
                  ℹ️ Bu liste, son 20 yedeğinizin geçmişini gösterir.
                  Yedeklerinizi buradan takip edebilirsiniz. Geri yükleme işlemi
                  için lütfen "Yedekten Geri Yükle" butonunu kullanın.
                </p>
              </div>
            </div>
          </div>
        );
      // SettingsPage.tsx içinde "hotkeys" tab render kısmında yapılacak değişiklik
      case "hotkeys":
        return (
          <div className="space-y-3">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <HotkeySettings
                onSave={(newHotkeys, newSpecialHotkeys) => {
                  // Kısayol değişikliği olduğunda, global event tetikle
                  window.dispatchEvent(
                    new CustomEvent("hotkeysUpdated", {
                      detail: {
                        hotkeys: newHotkeys,
                        specialHotkeys: newSpecialHotkeys,
                      },
                    })
                  );

                  // Kaydetme durumunu değiştir (diğer tablar gibi gösterge)
                  setSaveStatus({
                    status: "saved",
                    message: "Kısayollar kaydedildi",
                  });

                  // 3 saniye sonra mesajı kaldır
                  setTimeout(() => {
                    setSaveStatus({ status: "idle", message: "" });
                  }, 3000);
                }}
              />
            </div>
          </div>
        );
      case "license":
        return (
          <div className="space-y-3">
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
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-3
                  ">
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
                          <span className="rounded-full h-4 w-4 border-2 border-white border-t-transparent animate-spin" />
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

      case "about":
        return (
          <div className="space-y-3">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-col items-center justify-center text-center mb-8">
                <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <img
                    src={Icon}
                    alt="Uygulama Logo"
                    className="w-32 h-32 object-contain"
                    onError={(e) => {
                      e.currentTarget.src = "";
                      e.currentTarget.alt = "POS";
                    }}
                  />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Roxoe POS</h2>
                <p className="text-gray-500 mt-2">Sürüm {appVersion}</p>
              </div>

              <div className="space-y-4 mb-8">
                <h3 className="font-medium text-lg text-gray-800">
                  Uygulama Hakkında
                </h3>
                <p className="text-gray-600">
                  Bu POS uygulaması, küçük ve orta ölçekli işletmeler için
                  geliştirilmiş kapsamlı bir satış yönetim sistemidir. Barkod
                  okuyucu ve yazarkasa entegrasyonu, stok takibi, müşteri
                  yönetimi ve kapsamlı raporlama özellikleri içerir.
                </p>

                <p className="text-gray-600">
                  Uygulamamız, modern web teknolojileri kullanılarak
                  geliştirilmiş olup, hızlı ve güvenli bir şekilde çalışır.
                  İşletmenizin ihtiyaçlarına göre özelleştirilebilir ve
                  ölçeklenebilir.
                </p>

                <div className="pt-4">
                  <h3 className="font-medium text-lg text-gray-800">
                    Geliştirici Bilgileri
                  </h3>
                  <p className="text-gray-600 mt-2">
                    © 2025 Cretique, Tüm hakları saklıdır.
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-medium text-lg text-gray-800 mb-4">
                  İletişim
                </h3>
                <p className="text-gray-600 mb-4">
                  Sorularınız, önerileriniz veya geri bildirimleriniz mi var?
                  Bizimle iletişime geçin.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => {
                      window.location.href =
                        "mailto:msg@cretique.net?subject=POS%20Uygulaması%20Destek%20Talebi";
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Mail size={18} />
                    E-posta Gönder
                  </button>

                  <button
                    onClick={() => {
                      window.open("https://www.cretique.net/destek", "_blank");
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    <Info size={18} />
                    Destek Sayfası
                  </button>
                </div>
              </div>

              <div className="mt-6 text-sm text-gray-500 bg-blue-50 p-4 rounded-lg">
                <p>
                  ℹ️ Bu uygulama, en son güncellemeleri ve güvenlik yamalarını
                  otomatik olarak kontrol eder. Yeni bir güncelleme mevcut
                  olduğunda bildirim alacaksınız.
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
        {/* Aktif tab başlığını ana başlık olarak göster */}
        <h1 className="text-2xl font-bold text-gray-800">
          {tabs.find((tab) => tab.id === activeTab)?.title || "Ayarlar"}
        </h1>

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
              <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
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
