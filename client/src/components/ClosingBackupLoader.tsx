import React, { useEffect, useState } from 'react';

/**
 * Uygulama kapatılırken yedekleme işlemi için gösterilen yükleme ekranı
 */
interface ClosingBackupLoaderProps {
  onBackupComplete: (success: boolean) => void;
}

const ClosingBackupLoader: React.FC<ClosingBackupLoaderProps> = ({ onBackupComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('preparing');
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // İlerleme bildirimi için callback fonksiyonu - useEffect seviyesinde tanımlandı
    const progressHandler = (data: { stage: string, progress: number }) => {
      if (isMounted) {
        setStage(data.stage);
        setProgress(data.progress);
      }
    };

    const handleBackup = async () => {
      try {
        // Backup Progress event listener
        window.backupAPI.onBackupProgress(progressHandler);

        // Otomatik yedekleme işlemini başlat
        const result = await window.backupAPI.createBackup({
          description: "Kapatılırken Otomatik Yedekleme",
          backupType: "full",
          isAutoBackup: true
        });

        if (isMounted) {
          if (result.success) {
            setIsComplete(true);
            setStage('completed');
            setProgress(100);
            
            // Tamamlandı bilgisini yukarıya ilet (1 sn gecikmeli)
            setTimeout(() => {
              if (onBackupComplete && isMounted) {
                onBackupComplete(true);
              }
            }, 1000);
          } else {
            setError(result.error || "Yedekleme sırasında bir hata oluştu");
            // Hata durumunda da kapatılmasına izin ver (2 sn gecikmeli)
            setTimeout(() => {
              if (onBackupComplete && isMounted) {
                onBackupComplete(false);
              }
            }, 2000);
          }
        }
      } catch (error: any) {
        if (isMounted) {
          setError(error.message || "Beklenmeyen bir hata oluştu");
          // Hata durumunda da kapatılmasına izin ver (2 sn gecikmeli)
          setTimeout(() => {
            if (onBackupComplete && isMounted) {
              onBackupComplete(false);
            }
          }, 2000);
        }
      } finally {
        // Event listener'ı temizle
        if (isMounted) {
          window.backupAPI.offBackupProgress(progressHandler);
        }
      }
    };

    // Yedekleme işlemini başlat
    handleBackup();

    return () => {
      isMounted = false;
      // Component unmount olurken event listener'ı temizle
      window.backupAPI.offBackupProgress(progressHandler);
    };
  }, [onBackupComplete]);

  // Stage için insan-dostu metin
  const getStageName = (stage: string) => {
    switch (stage) {
      case 'preparing':
        return 'Yedekleme hazırlanıyor';
      case 'Veri serileştiriliyor':
        return 'Veriler hazırlanıyor';
      case 'Yedek dosyası kaydediliyor':
        return 'Yedek kaydediliyor';
      case 'Yedekleme tamamlandı':
      case 'completed':
        return 'Yedekleme tamamlandı';
      default:
        return stage;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/20 p-8 max-w-md w-full">
        <div className="text-center">
          {/* Animasyon ve İkon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              {/* Arkadaki pulsing effect */}
              <div className="absolute inset-0 rounded-full bg-indigo-600/20 animate-ping"></div>
              
              {/* İlerleme halkası */}
              <svg className="w-24 h-24 relative z-10" viewBox="0 0 100 100">
                <circle 
                  className="text-gray-800" 
                  strokeWidth="4" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="46" 
                  cx="50" 
                  cy="50" 
                />
                <circle 
                  className="text-indigo-500 transition-all duration-300 ease-in-out" 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="46" 
                  cx="50" 
                  cy="50" 
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={2 * Math.PI * 46 * (1 - progress / 100)}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              
              {/* Ortadaki yüzde */}
              <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
                {Math.round(progress)}%
              </div>
            </div>
          </div>
          
          {/* Başlık */}
          <h2 className="text-xl font-bold text-white mb-2">
            {isComplete ? 'Yedekleme Tamamlandı' : 'Kapatılmadan Önce Yedekleniyor'}
          </h2>
          
          {/* Alt metin */}
          <p className="text-indigo-200 mb-4">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : (
              getStageName(stage)
            )}
          </p>
          
          {/* İlerleme çubuğu */}
          <div className="w-full bg-gray-800 rounded-full h-2 mb-6">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ease-out ${
                error ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {/* Bilgilendirme metni */}
          <p className="text-gray-400 text-sm">
            {error 
              ? "Uygulama kapatılacak, ancak bazı veriler yedeklenemedi."
              : isComplete 
                ? "Yedekleme başarıyla tamamlandı. Uygulama güvenle kapatılıyor..." 
                : "Lütfen bekleyin. Verileriniz korunuyor..."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClosingBackupLoader;