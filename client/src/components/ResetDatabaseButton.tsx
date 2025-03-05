import React, { useState } from 'react';
import { resetDatabases } from '../services/productDB';

const ResetDatabaseButton: React.FC = () => {
  const [resetting, setResetting] = useState(false);

  const handleResetDatabases = async () => {
    if (resetting) return; // İşlem zaten devam ediyor
    
    const confirmed = window.confirm(
      "Veritabanını sıfırlamak istediğinize emin misiniz? Bu işlem, tüm uygulama verilerini sıfırlayacaktır."
    );
    
    if (!confirmed) return;
    
    try {
      setResetting(true);
      
      // Önce yerel depolama ayarlarını temizle
      localStorage.removeItem('db_force_reset');
      
      // Tüm IndexedDB veritabanlarını listele
      const dbList = await indexedDB.databases();
      console.log("Silinecek veritabanları:", dbList);
      
      // Hepsini sil
      for (const db of dbList) {
        if (db.name) {
          console.log(`Siliniyor: ${db.name}`);
          await indexedDB.deleteDatabase(db.name);
          console.log(`${db.name} silindi`);
        }
      }
      
      // DB_VERSION değerini artırmak için localStorage'a işaret koy
      localStorage.setItem('db_version_upgraded', 'true');
      
      // Sayfayı yenile
      console.log("Tüm veritabanları başarıyla silindi, sayfa yenileniyor...");
      window.location.reload();
    } catch (error) {
      console.error("Veritabanı sıfırlama hatası:", error);
      alert("Veritabanı sıfırlanırken bir hata oluştu! Lütfen uygulamayı yeniden başlatın.");
      setResetting(false);
    }
  };

  return (
    <button
      onClick={handleResetDatabases}
      disabled={resetting}
      className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 flex items-center justify-center"
      title="Veritabanını sıfırla"
    >
      {resetting ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Sıfırlanıyor...
        </>
      ) : (
        "Veritabanını Sıfırla"
      )}
    </button>
  );
};

export default ResetDatabaseButton;