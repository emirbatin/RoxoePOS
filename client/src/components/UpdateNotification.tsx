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
    // Not redefining ipcRenderer since it's already defined in electron-env.d.ts
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
    if (window.updaterAPI) {
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

  if (!isVisible || !updateStatus) return null;

  const progressPercent =
    updateStatus.status === "downloading" && updateStatus.progress
      ? updateStatus.progress.percent
      : 0;

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

  const getSecondaryText = () => {
    if (updateStatus.status === "downloading" && updateStatus.progress) {
      const { percent, transferred, total, speed } = updateStatus.progress;
      return `${percent.toFixed(1)}% - ${formatBytes(transferred)} / ${formatBytes(
        total
      )} (${speed} MB/s)`;
    }
    if (updateStatus.status === "downloaded") {
      return "Güncelleme hazır, uygulamayı yeniden başlatarak yükleyebilirsiniz";
    }
    if (updateStatus.status === "error") {
      return updateStatus.error || "Bilinmeyen hata";
    }
    return "";
  };

  const getIconByStatus = () => {
    switch (updateStatus.status) {
      case "checking":
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case "available":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
      case "downloading":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
        );
      case "downloaded":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        );
      case "error":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
      default:
        return null;
    }
  };

  // Daha koyu ve premium renkler
  const getStatusColor = () => {
    switch (updateStatus.status) {
      case "checking":
        return "bg-gray-800 border-gray-700";
      case "available":
        return "bg-indigo-900 border-indigo-800";
      case "downloading":
        return "bg-indigo-800 border-indigo-700";
      case "downloaded":
        return "bg-emerald-900 border-emerald-800";
      case "error":
        return "bg-rose-900 border-rose-800";
      default:
        return "bg-gray-800 border-gray-700";
    }
  };

  // Progress çubuğu rengi
  const getProgressColor = () => {
    switch (updateStatus.status) {
      case "downloading":
        return "bg-indigo-400";
      case "downloaded":
        return "bg-emerald-400";
      default:
        return "bg-gray-400";
    }
  };

  // Buton stili
  const getButtonStyle = () => {
    switch (updateStatus.status) {
      case "downloaded":
        return "bg-emerald-800 hover:bg-emerald-700 text-white";
      case "error":
        return "bg-rose-800 hover:bg-rose-700 text-white";
      default:
        return "bg-indigo-800 hover:bg-indigo-700 text-white";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full sm:w-96 animate-fadeIn">
      <div className={`backdrop-blur-md bg-opacity-95 border ${getStatusColor()} rounded-xl shadow-2xl overflow-hidden`}>
        {/* Üst kısım - Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-opacity-20 border-white">
          <div className="flex items-center space-x-2">
            <span className="text-white">{getIconByStatus()}</span>
            <h3 className="text-white font-medium text-sm">{getPrimaryText()}</h3>
          </div>
          <button
            className="text-gray-300 hover:text-white transition-colors p-1"
            onClick={() => setIsVisible(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* İçerik */}
        <div className="p-4">
          {updateStatus.status === "downloading" && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                <span>{progressPercent.toFixed(1)}%</span>
                <span>{formatBytes(updateStatus.progress?.transferred || 0)} / {formatBytes(updateStatus.progress?.total || 0)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className={`${getProgressColor()} h-1.5 rounded-full transition-all duration-300`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-300 mt-1 text-right">{updateStatus.progress?.speed} MB/s</p>
            </div>
          )}

          {updateStatus.status !== "downloading" && getSecondaryText() && (
            <p className="text-sm text-gray-300 mb-3">{getSecondaryText()}</p>
          )}

          {updateStatus.status === "downloaded" && (
            <button
              className={`w-full ${getButtonStyle()} px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1`}
              onClick={() => {
                // Using the global ipcRenderer from electron-env.d.ts
                if (window.ipcRenderer) {
                  // TypeScript needs to know the function exists
                  // @ts-ignore
                  window.ipcRenderer.send("quit-and-install");
                  
                  // Bildirimi kapat
                  setIsVisible(false);
                }
              }}
            >
              <span>Şimdi Güncelle</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </button>
          )}

          {updateStatus.status === "error" && (
            <button
              className={`w-full ${getButtonStyle()} px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1`}
              onClick={() => window.updaterAPI.checkForUpdates()}
            >
              <span>Tekrar Dene</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;