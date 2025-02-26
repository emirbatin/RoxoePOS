// ResetDatabaseButton.tsx
import React, { useState } from 'react';
import { repairDatabase } from '../services/productDB';

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
      await repairDatabase();
      // repairDatabase zaten otomatik olarak sayfayı yeniliyor
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
      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
      title="Veritabanını sıfırla"
    >
      {resetting ? "Sıfırlanıyor..." : "Veritabanını Sıfırla"}
    </button>
  );
};

export default ResetDatabaseButton;