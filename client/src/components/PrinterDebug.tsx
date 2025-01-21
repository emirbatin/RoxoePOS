import React, { useEffect } from 'react';

interface PrinterDebugProps {
  isVisible: boolean;
  logs: string[];
  onClose: () => void; // Bileşenin kapanmasını kontrol etmek için bir prop
}

const PrinterDebug: React.FC<PrinterDebugProps> = ({ isVisible, logs, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      // 5 saniye sonra onClose çağrılır
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      // Temizlik: Bileşen kapanmadan önce zamanlayıcıyı temizle
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 p-4 bg-gray-800 text-white rounded-lg max-w-md opacity-90 shadow-lg">
      <h3 className="font-semibold mb-2">Yazıcı Test Çıktısı</h3>
      <div className="text-xs font-mono max-h-60 overflow-y-auto space-y-1">
        {logs.map((log, index) => (
          <div key={index} className="py-1">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrinterDebug;