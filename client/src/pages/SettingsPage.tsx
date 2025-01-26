import React, { useState, useEffect } from "react";
import { Printer, Save, Barcode } from "lucide-react";
import { POSConfig, SerialOptions } from "../types/pos";
import { BarcodeConfig } from "../types/barcode";
import clsx from "clsx";
import Button from "../components/Button";

const SettingsPage: React.FC = () => {
  const [posConfig, setPosConfig] = useState<POSConfig>({
    type: "Ingenico",
    baudRate: 9600,
    protocol: "OPOS",
    commandSet: {
      payment: "0x02payment0x03",
      cancel: "0x02cancel0x03",
      status: "0x02status0x03",
    },
  });

  const [serialOptions, setSerialOptions] = useState<SerialOptions>({
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none",
  });

  const [barcodeConfig, setBarcodeConfig] = useState<BarcodeConfig>({
    type: "USB HID",
    baudRate: 9600,
    enabled: true,
    prefix: "",
    suffix: "\n",
  });

  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "unknown"
  >("unknown");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const loadSettings = () => {
      const savedPosConfig = localStorage.getItem("posConfig");
      const savedSerialOptions = localStorage.getItem("serialOptions");
      const savedBarcodeConfig = localStorage.getItem("barcodeConfig");

      if (savedPosConfig) setPosConfig(JSON.parse(savedPosConfig));
      if (savedSerialOptions) setSerialOptions(JSON.parse(savedSerialOptions));
      if (savedBarcodeConfig) setBarcodeConfig(JSON.parse(savedBarcodeConfig));
    };

    loadSettings();
  }, []);

  const testConnection = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await port.open(serialOptions);

      const writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(posConfig.commandSet.status));
      writer.releaseLock();

      const reader = port.readable.getReader();
      const { value } = await reader.read();
      reader.releaseLock();

      if (value) {
        setConnectionStatus("connected");
        setLastChecked(new Date());
        alert("POS bağlantısı başarılı ve cihaz yanıt verdi!");
      }

      await port.close();
    } catch (err) {
      const error = err as Error;
      setConnectionStatus("disconnected");
      setLastChecked(new Date());
      alert("Bağlantı hatası: " + error.message);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem("posConfig", JSON.stringify(posConfig));
      localStorage.setItem("serialOptions", JSON.stringify(serialOptions));
      localStorage.setItem("barcodeConfig", JSON.stringify(barcodeConfig));
      alert("Ayarlar başarıyla kaydedildi");
    } catch (err) {
      const error = err as Error;
      alert("Ayarlar kaydedilirken hata oluştu: " + error.message);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Ayarlar</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* POS Ayarları */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Printer
                className={clsx(
                  "transition-colors",
                  connectionStatus === "connected" && "text-green-500",
                  connectionStatus === "disconnected" && "text-red-500",
                  connectionStatus === "unknown" && "text-gray-400"
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

          <div className="space-y-4">
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

            <div className="flex gap-2 pt-4">
              <Button onClick={testConnection} variant="primary" icon={Printer}>
                Bağlantıyı Test Et
              </Button>
            </div>
          </div>
        </div>

        {/* Barkod Okuyucu Ayarları */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <Barcode className="text-primary-600" size={24} />
            <h2 className="text-lg font-semibold">Barkod Okuyucu Ayarları</h2>
          </div>

          <div className="space-y-4">
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
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

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
      </div>
      <div className="m-6">
        <Button onClick={saveSettings} variant="save" icon={Save}>
          Kaydet
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
