import React, { useEffect, useState } from "react";

// TypeScript için window interface'ini genişlet
declare global {
  interface Window {
    updaterAPI: {
      checkForUpdates: () => void;
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onUpdateDownloaded: (callback: (info: any) => void) => void;
      onUpdateError: (callback: (err: any) => void) => void;
      onUpdateMessage: (callback: (message: string) => void) => void;
      onUpdateProgress: (callback: (progressObj: any) => void) => void;
      onUpdateStatus: (callback: (statusObj: any) => void) => void;
      testUpdateAvailable?: () => void;
      testUpdateDownloaded?: () => void;
      testUpdateError?: () => void;
    };
  }
}

// İlerleme durumu tipi
interface ProgressDetails {
  percent: number;
  transferred: number;
  total: number;
  speed: string;
  remaining: number;
}

// Güncelleme durumu tipi
interface UpdateStatus {
  status: "checking" | "available" | "downloading" | "downloaded" | "error";
  version?: string;
  progress?: ProgressDetails;
  error?: string;
}

// Bayt boyutunu insan tarafından okunabilir formata dönüştürme
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const UpdateNotification: React.FC = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // updaterAPI mevcut mu kontrol et
    if (window.updaterAPI) {
      // Güncelleme durumu event'i
      window.updaterAPI.onUpdateStatus((status) => {
        console.log("Güncelleme durumu:", status);
        setUpdateStatus(status);

        if (status.status !== "checking") {
          setIsVisible(true);
        }
      });

      // 20 saniye sonra otomatik olarak bildirimi kapat (sadece indirme tamamlandığında)
      if (updateStatus?.status === "downloaded") {
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, 20000);

        return () => clearTimeout(timer);
      }
    }
  }, [updateStatus?.status]);

  // Bildirim gösterilecek bir durum yoksa null dön
  if (!isVisible || !updateStatus) {
    return null;
  }

  // İlerleme çubuğunun yüzdesini belirle
  const progressPercent =
    updateStatus.status === "downloading" && updateStatus.progress
      ? updateStatus.progress.percent
      : 0;

  // Duruma göre birincil metin
  const getPrimaryText = () => {
    switch (updateStatus.status) {
      case "checking":
        return "Güncellemeler kontrol ediliyor...";
      case "available":
        return `Yeni sürüm (v${updateStatus.version}) bulundu`;
      case "downloading":
        return `Güncelleme indiriliyor: v${updateStatus.version}`;
      case "downloaded":
        return `Güncelleme hazır: v${updateStatus.version}`;
      case "error":
        return "Güncelleme sırasında hata oluştu";
      default:
        return "";
    }
  };

  // Duruma göre ikincil metin
  const getSecondaryText = () => {
    if (updateStatus.status === "downloading" && updateStatus.progress) {
      const { percent, transferred, total, speed } = updateStatus.progress;
      return `${percent.toFixed(1)}% - ${formatBytes(
        transferred
      )} / ${formatBytes(total)} (${speed} MB/s)`;
    }

    if (updateStatus.status === "downloaded") {
      return "Uygulamayı yeniden başlatarak güncellemeyi uygulayabilirsiniz";
    }

    if (updateStatus.status === "error") {
      return updateStatus.error || "Bilinmeyen hata";
    }

    return "";
  };

  // Duruma göre arkaplan rengi
  const getBgColor = () => {
    switch (updateStatus.status) {
      case "checking":
        return "bg-gray-700";
      case "available":
        return "bg-blue-600";
      case "downloading":
        return "bg-blue-500";
      case "downloaded":
        return "bg-green-600";
      case "error":
        return "bg-red-600";
      default:
        return "bg-gray-700";
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md shadow-lg rounded-lg overflow-hidden">
      <div className={`p-4 text-white ${getBgColor()}`}>
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg">{getPrimaryText()}</h3>
          <button
            className="text-white hover:text-gray-200 ml-4"
            onClick={() => setIsVisible(false)}
          >
            ×
          </button>
        </div>

        {updateStatus.status === "downloading" && (
          <div className="mt-2">
            <div className="w-full bg-gray-300 rounded-full h-2.5 mb-2">
              <div
                className="bg-white h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <p className="text-sm">{getSecondaryText()}</p>
          </div>
        )}

        {updateStatus.status !== "downloading" && getSecondaryText() && (
          <p className="text-sm mt-1">{getSecondaryText()}</p>
        )}

        {updateStatus.status === "downloaded" && (
          <button
            className="mt-3 bg-white text-green-600 px-4 py-1.5 rounded-md hover:bg-gray-100 font-medium text-sm"
            onClick={() => {
              if (window.ipcRenderer) {
                window.ipcRenderer.send("quit-and-install");
              }
            }}
          >
            Şimdi Yeniden Başlat
          </button>
        )}

        {updateStatus.status === "error" && (
          <button
            className="mt-3 bg-white text-red-600 px-4 py-1.5 rounded-md hover:bg-gray-100 font-medium text-sm"
            onClick={() => window.updaterAPI.checkForUpdates()}
          >
            Tekrar Dene
          </button>
        )}
      </div>
    </div>
  );
};

export default UpdateNotification;
