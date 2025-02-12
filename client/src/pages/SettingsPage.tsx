// pages/SettingsPage.tsx

import React, { useEffect, useState } from "react";
import { Printer, Save, Barcode } from "lucide-react";
import { POSConfig, SerialOptions } from "../types/pos";
import { BarcodeConfig } from "../types/barcode";
import { ReceiptConfig } from "../types/receipt";
import clsx from "clsx";
import Button from "../components/ui/Button";
import { useAlert } from "../components/AlertProvider";

const SettingsPage: React.FC = () => {
  const { showSuccess, showError } = useAlert();

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

  // 6) Load Settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedPosConfig = localStorage.getItem("posConfig");
        const savedSerialOptions = localStorage.getItem("serialOptions");
        const savedBarcodeConfig = localStorage.getItem("barcodeConfig");
        const savedReceiptConfig = localStorage.getItem("receiptConfig");

        if (savedPosConfig) setPosConfig(JSON.parse(savedPosConfig));
        if (savedSerialOptions) setSerialOptions(JSON.parse(savedSerialOptions));
        if (savedBarcodeConfig) setBarcodeConfig(JSON.parse(savedBarcodeConfig));
        if (savedReceiptConfig) setReceiptConfig(JSON.parse(savedReceiptConfig));
      } catch (err) {
        console.error("Ayarlar yüklenirken hata:", err);
      }
    };
    loadSettings();
  }, []);

  // 7) POS Bağlantı Testi
  const testConnection = async () => {
    if (posConfig.manualMode) {
      // Manuel mod aktifken gerçek bağlantı testi yapmıyoruz
      setConnectionStatus("connected");
      setLastChecked(new Date());
      showSuccess("Manuel mod aktif - Bağlantı testi atlandı!");
      return;
    }

    try {
      // Web Serial API
      const port = await navigator.serial.requestPort();
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

  // 8) Save Settings to localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem("posConfig", JSON.stringify(posConfig));
      localStorage.setItem("serialOptions", JSON.stringify(serialOptions));
      localStorage.setItem("barcodeConfig", JSON.stringify(barcodeConfig));
      localStorage.setItem("receiptConfig", JSON.stringify(receiptConfig));
      showSuccess("Ayarlar başarıyla kaydedildi");
    } catch (err: any) {
      showError("Ayarlar kaydedilirken hata oluştu: " + err.message);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Ayarlar</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1) POS Ayarları */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Printer
                className={clsx(
                  "transition-colors",
                  (connectionStatus === "connected" || posConfig.manualMode) &&
                    "text-green-500",
                  connectionStatus === "disconnected" &&
                    !posConfig.manualMode &&
                    "text-red-500",
                  connectionStatus === "unknown" &&
                    !posConfig.manualMode &&
                    "text-gray-400"
                )}
                size={24}
              />
              <h2 className="text-lg font-semibold">POS Cihazı Ayarları</h2>
            </div>
            {lastChecked && (
              <div className="text-sm text-gray-500">
                Son kontrol: {lastChecked.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Manuel Mod Toggle */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Manuel Mod
                </span>
                <p className="text-sm text-gray-500">
                  POS cihazı olmadan çalışmayı etkinleştir
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={posConfig.manualMode}
                  onChange={(e) =>
                    setPosConfig({ ...posConfig, manualMode: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>

          {/* Bağlantı ayar formu (manualMode aktifse devre dışı) */}
          <div
            className={clsx(
              "space-y-4",
              posConfig.manualMode && "opacity-50 pointer-events-none"
            )}
          >
            {/* POS Markası */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                POS Markası
              </label>
              <input
                type="text"
                value={posConfig.type}
                onChange={(e) =>
                  setPosConfig({ ...posConfig, type: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Baud Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Baud Rate
              </label>
              <select
                value={serialOptions.baudRate}
                onChange={(e) =>
                  setSerialOptions({
                    ...serialOptions,
                    baudRate: Number(e.target.value),
                  })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="9600">9600</option>
                <option value="19200">19200</option>
                <option value="38400">38400</option>
                <option value="115200">115200</option>
              </select>
            </div>

            {/* Data Bits */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Bits
              </label>
              <select
                value={serialOptions.dataBits}
                onChange={(e) =>
                  setSerialOptions({
                    ...serialOptions,
                    dataBits: Number(e.target.value),
                  })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="7">7</option>
                <option value="8">8</option>
              </select>
            </div>

            {/* Stop Bits */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stop Bits
              </label>
              <select
                value={serialOptions.stopBits}
                onChange={(e) =>
                  setSerialOptions({
                    ...serialOptions,
                    stopBits: Number(e.target.value),
                  })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>

            {/* Parity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parity
              </label>
              <select
                value={serialOptions.parity}
                onChange={(e) =>
                  setSerialOptions({
                    ...serialOptions,
                    parity: e.target.value as "none" | "even" | "odd",
                  })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="none">None</option>
                <option value="even">Even</option>
                <option value="odd">Odd</option>
              </select>
            </div>

            {/* Flow Control */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flow Control
              </label>
              <select
                value={serialOptions.flowControl}
                onChange={(e) =>
                  setSerialOptions({
                    ...serialOptions,
                    flowControl: e.target.value as "none" | "hardware",
                  })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="none">None</option>
                <option value="hardware">Hardware</option>
              </select>
            </div>

            {/* Bağlantıyı Test Et Butonu */}
            <div className="flex gap-2 pt-4">
              <Button onClick={testConnection} variant="primary" icon={Printer}>
                {posConfig.manualMode ? "Manuel Mod Aktif" : "Bağlantıyı Test Et"}
              </Button>
            </div>
          </div>
        </div>

        {/* 2) Barkod Okuyucu Ayarları */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <Barcode className="text-primary-600" size={24} />
            <h2 className="text-lg font-semibold">Barkod Okuyucu Ayarları</h2>
          </div>

          <div className="space-y-4">
            {/* Okuyucu Tipi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Okuyucu Tipi
              </label>
              <select
                value={barcodeConfig.type}
                onChange={(e) =>
                  setBarcodeConfig({ ...barcodeConfig, type: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="USB HID">USB (HID)</option>
                <option value="USB COM">USB (COM Port)</option>
                <option value="PS/2">PS/2</option>
              </select>
            </div>

            {/* Aktif Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Aktif</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={barcodeConfig.enabled}
                  onChange={(e) =>
                    setBarcodeConfig({
                      ...barcodeConfig,
                      enabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Prefix */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Önek (Prefix)
              </label>
              <input
                type="text"
                value={barcodeConfig.prefix}
                onChange={(e) =>
                  setBarcodeConfig({ ...barcodeConfig, prefix: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Opsiyonel"
              />
            </div>

            {/* Suffix */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sonek (Suffix)
              </label>
              <input
                type="text"
                value={barcodeConfig.suffix}
                onChange={(e) =>
                  setBarcodeConfig({ ...barcodeConfig, suffix: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Varsayılan: \n (Enter)"
              />
            </div>
          </div>
        </div>

        {/* 3) Fiş Ayarları */}
        <div className="bg-white rounded-lg shadow-sm p-6 md:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Printer className="text-primary-600" size={24} />
            <h2 className="text-lg font-semibold">Fiş Ayarları</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Market Bilgileri */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-700">
                Market Bilgileri
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Market Adı
                </label>
                <input
                  type="text"
                  value={receiptConfig.storeName}
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      storeName: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      legalName: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      address: [e.target.value, receiptConfig.address[1]],
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      address: [receiptConfig.address[0], e.target.value],
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      phone: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Örn: (212) 123 45 67"
                />
              </div>
            </div>

            {/* Vergi ve Yasal Bilgiler */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-700">
                Vergi ve Yasal Bilgiler
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vergi Dairesi
                </label>
                <input
                  type="text"
                  value={receiptConfig.taxOffice}
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      taxOffice: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      taxNumber: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      mersisNo: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      footer: {
                        ...receiptConfig.footer,
                        message: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  onChange={(e) =>
                    setReceiptConfig({
                      ...receiptConfig,
                      footer: {
                        ...receiptConfig.footer,
                        returnPolicy: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Örn: Ürün iade ve değişimlerinde bu fiş ve ambalaj gereklidir"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kaydet Butonu */}
      <div className="m-6">
        <Button onClick={saveSettings} variant="save" icon={Save}>
          Kaydet
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;