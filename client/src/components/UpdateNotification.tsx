import React, { useEffect, useState } from 'react';

// TypeScript için window interface'ini genişlet
declare global {
  interface Window {
    updaterAPI: {
      checkForUpdates: () => void;
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onUpdateDownloaded: (callback: (info: any) => void) => void;
      onUpdateError: (callback: (err: any) => void) => void;
      onUpdateMessage: (callback: (message: string) => void) => void;
    };
  }
}

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // updaterAPI mevcut mu kontrol et
    if (window.updaterAPI) {
      // Güncelleme mevcut event'i
      window.updaterAPI.onUpdateAvailable((info) => {
        console.log('Güncelleme mevcut:', info);
        setUpdateAvailable(true);
        setUpdateVersion(info.version);
      });

      // Güncelleme indirildi event'i
      window.updaterAPI.onUpdateDownloaded((info) => {
        console.log('Güncelleme indirildi:', info);
        setUpdateDownloaded(true);
        setUpdateAvailable(false);
        setUpdateVersion(info.version);
      });

      // Güncelleme hatası event'i
      window.updaterAPI.onUpdateError((err) => {
        console.error('Güncelleme hatası:', err);
        setError(err.message || 'Güncelleme sırasında bir hata oluştu');
      });

      // Güncelleme mesajı event'i
      window.updaterAPI.onUpdateMessage((message) => {
        console.log('Güncelleme mesajı:', message);
        setUpdateMessage(message);
      });
    }
  }, []);

  // Bildirim gösterilecek bir durum yoksa null dön
  if (!updateAvailable && !updateDownloaded && !updateMessage && !error) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      {updateAvailable && (
        <div className="bg-blue-500 text-white p-4 rounded-lg shadow-lg mb-2">
          <h3 className="font-bold text-lg">Güncelleme Mevcut</h3>
          <p>Yeni sürüm (v{updateVersion}) mevcut ve indiriliyor...</p>
        </div>
      )}

      {updateDownloaded && (
        <div className="bg-green-500 text-white p-4 rounded-lg shadow-lg mb-2">
          <h3 className="font-bold text-lg">Güncelleme Hazır</h3>
          <p>Yeni sürüm (v{updateVersion}) indirildi!</p>
          <p className="text-sm mt-1">Uygulamayı kapatıp yeniden açtığınızda güncellemeler yüklenecektir.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg mb-2">
          <h3 className="font-bold text-lg">Güncelleme Hatası</h3>
          <p>{error}</p>
          <button 
            className="mt-2 bg-white text-red-500 px-4 py-1 rounded-md hover:bg-gray-100"
            onClick={() => window.updaterAPI.checkForUpdates()}
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {updateMessage && (
        <div className="bg-gray-700 text-white p-4 rounded-lg shadow-lg mb-2">
          <p>{updateMessage}</p>
        </div>
      )}
    </div>
  );
};

export default UpdateNotification;