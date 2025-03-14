// src/components/LicenseActivation.tsx
import React, { useState } from 'react';
import { useAlert } from "./AlertProvider";

interface LicenseActivationProps {
  onSuccess: () => void;
}

const LicenseActivation: React.FC<LicenseActivationProps> = ({ onSuccess }) => {
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [status, setStatus] = useState<{
    loading: boolean;
    error: string | null;
  }>({
    loading: false,
    error: null
  });

  const { showSuccess } = useAlert();

  const isElectron = window && window.ipcRenderer !== undefined;

  const handleActivate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setStatus({ loading: true, error: null });
  
    try {
      if (isElectron) {
        // Masaüstü için IPC kullan
        const result = await window.ipcRenderer.invoke('activate-license', licenseKey);
        
        if (result.success) {
          showSuccess('Lisans başarıyla aktive edildi');
          onSuccess();
        } else {
          throw new Error(result.error || 'Aktivasyon başarısız');
        }
      } else {
        // Web için API çağrısı yap
        const response = await fetch('https://roxoepos-server.onrender.com/api/licenses/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ licenseKey, machineId: 'web-user' }),
        });
  
        const result = await response.json();
  
        if (result.success) {
          showSuccess('Lisans başarıyla aktive edildi (Web)');
          onSuccess();
        } else {
          throw new Error(result.error || 'Web aktivasyonu başarısız');
        }
      }
    } catch (error) {
      setStatus({
        loading: false,
        error: error instanceof Error ? error.message : 'Aktivasyon sırasında bir hata oluştu'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Yazılım Aktivasyonu
          </h2>
          <p className="mt-2 text-gray-600">
            Devam etmek için lisans anahtarınızı girin
          </p>
        </div>

        <form onSubmit={handleActivate} className="space-y-6">
          <div>
            <label
              htmlFor="licenseKey"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Lisans Anahtarı
            </label>
            <input
              type="text"
              id="licenseKey"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              required
              disabled={status.loading}
            />
          </div>

          {status.error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-sm text-red-700">{status.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status.loading}
            className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
              status.loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {status.loading ? "Aktivasyon yapılıyor..." : "Lisansı Aktive Et"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LicenseActivation;
