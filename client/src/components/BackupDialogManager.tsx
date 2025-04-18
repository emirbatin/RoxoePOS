import React, { useState, useEffect, useCallback } from 'react';
import ClosingBackupLoader from './ClosingBackupLoader';

/**
 * Uygulama kapatma işlemlerini yöneten bileşen.
 * Electron main process ile iletişimi sağlar ve kapatma öncesi yedekleme yapar.
 */
const BackupDialogManager: React.FC = () => {
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  
  // Yedekleme tamamlandığında çağrılacak fonksiyon
  const handleBackupComplete = useCallback((success: boolean) => {
    console.log(`Yedekleme ${success ? 'başarıyla' : 'hatayla'} tamamlandı, uygulama kapatılıyor...`);
    // Yedekleme tamamlandı bilgisini gönder ve uygulamayı kapat
    window.ipcRenderer.send('confirm-app-close');
  }, []);
  
  // Electron'dan gelen kapatma olayını dinle
  useEffect(() => {
    // Kapatma isteğini yakala
    const handleCloseRequest = () => {
      console.log('Kapatma isteği alındı, yedekleme başlatılıyor...');
      setShowBackupDialog(true);
    };
    
    // Event listener'ları ekle
    window.ipcRenderer.on('app-close-requested', handleCloseRequest);
    
    // Component unmount olduğunda event listener'ları temizle
    return () => {
      window.ipcRenderer.off('app-close-requested', handleCloseRequest);
    };
  }, []);
  
  // Sadece gerektiğinde yedekleme ekranını göster
  if (!showBackupDialog) return null;
  
  return <ClosingBackupLoader onBackupComplete={handleBackupComplete} />;
};

export default BackupDialogManager;