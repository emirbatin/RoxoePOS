import React from "react";
import { Key, AlertTriangle } from "lucide-react";

interface LicenseCardProps {
  licenseInfo: {
    maskedLicense: string;
    expiresAt: string | null;
    daysLeft: number | null;
    isExpired: boolean;
    isExpiring: boolean;
    isActive: boolean;
  };
  onRenew: () => void;
  renewalLoading: boolean;
  renewalError: string | null;
}

const LicenseCard: React.FC<LicenseCardProps> = ({
  licenseInfo,
  onRenew,
  renewalLoading,
  renewalError,
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between border-b pb-2 mb-4">
        <div className="flex items-center gap-2">
          <Key
            className={`w-6 h-6 ${
              licenseInfo.isActive ? "text-green-500" : "text-red-500"
            }`}
          />
          <h3 className="text-xl font-bold">Lisans Bilgileri</h3>
        </div>
        {(licenseInfo.isExpired || licenseInfo.isExpiring) && (
          <button
            onClick={onRenew}
            disabled={renewalLoading}
            className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            {renewalLoading
              ? "Yenileniyor..."
              : licenseInfo.isExpired
              ? "Lisansı Aktifleştir"
              : "Lisansı Yenile"}
          </button>
        )}
      </div>
      {licenseInfo.isExpired && (
        <div className="flex items-center gap-2 p-2 bg-red-100 rounded-md mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-700">Lisans süresi dolmuş.</span>
        </div>
      )}
      {licenseInfo.isExpiring && !licenseInfo.isExpired && (
        <div className="flex items-center gap-2 p-2 bg-yellow-100 rounded-md mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <span className="text-sm text-yellow-700">
            Lisansınız {licenseInfo.daysLeft} gün içinde dolacak.
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Lisans Anahtarı</p>
          <p className="font-medium text-gray-800">{licenseInfo.maskedLicense}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Geçerlilik</p>
          <p className="font-medium text-gray-800">
            {licenseInfo.expiresAt && licenseInfo.daysLeft !== null
              ? `${licenseInfo.daysLeft} gün kaldı (${new Date(
                  licenseInfo.expiresAt
                ).toLocaleDateString()})`
              : "Süresiz"}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Durum</p>
          <p
            className={`font-medium ${
              licenseInfo.isActive ? "text-green-600" : "text-red-600"
            }`}
          >
            {licenseInfo.isActive ? "Aktif" : "Pasif"}
          </p>
        </div>
      </div>
      {renewalError && <p className="mt-4 text-sm text-red-600">{renewalError}</p>}
    </div>
  );
};

export default LicenseCard;