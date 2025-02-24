import { ipcMain } from 'electron';
import { machineIdSync } from 'node-machine-id';
import Store from 'electron-store';
import axios from 'axios';

interface LicenseData {
  token: string;
  licenseKey: string; // Gerçek lisans anahtarı
  machineId: string;
  activatedAt: string;
  expiresAt: string | null; // Null ise sınırsız
}

interface LicenseResponse {
  success: boolean;
  token?: string;
  licenseKey?: string;
  expires?: string | null;
  error?: string;
}

class LicenseManager {
  private store: Store<{ licenseData?: LicenseData }>;
  private API_URL: string;

  constructor() {
    this.store = new Store<{ licenseData?: LicenseData }>({
      name: 'license',
      encryptionKey: 'your-secret-key'
    });
    this.API_URL = 'https://roxoepos-server.onrender.com/api/licenses';
    this.setupListeners();
  }

  private setupListeners() {
    ipcMain.handle('check-license', async () => {
      try {
        const licenseData = this.store.get('licenseData');
        if (!licenseData) {
          return { isValid: false };
        }
        const currentMachineId = machineIdSync();
        if (currentMachineId !== licenseData.machineId) {
          return { isValid: false, error: 'Invalid machine ID' };
        }
        if (licenseData.expiresAt && new Date() > new Date(licenseData.expiresAt)) {
          return { isValid: false, error: 'License expired' };
        }
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: 'License check failed' };
      }
    });

    ipcMain.handle('activate-license', async (_, licenseKey: string) => {
      try {
        const machineId = machineIdSync();
        const response = await axios.post<LicenseResponse>(`${this.API_URL}/verify`, {
          licenseKey,
          machineId,
          companyInfo: { name: 'Test Company' }
        });
        if (response.data.success && response.data.token && response.data.licenseKey) {
          const expiresAt = response.data.expires ? new Date(response.data.expires).toISOString() : null;
          const licenseData: LicenseData = {
            token: response.data.token,
            licenseKey: response.data.licenseKey,
            machineId,
            activatedAt: new Date().toISOString(),
            expiresAt,
          };
          this.store.set('licenseData', licenseData);
          return { success: true };
        }
        return { success: false, error: response.data.error || 'Activation failed' };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Activation failed',
        };
      }
    });

    ipcMain.handle('get-license-info', async () => {
      try {
        const licenseData = this.store.get('licenseData');
        if (!licenseData) return { exists: false };
        const currentMachineId = machineIdSync();
        if (currentMachineId !== licenseData.machineId) {
          return { exists: false, error: 'Invalid machine ID' };
        }
        const now = new Date();
        let daysLeft: number | null = null;
        if (licenseData.expiresAt) {
          const expiresAt = new Date(licenseData.expiresAt);
          const diffTime = expiresAt.getTime() - now.getTime();
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        const isExpired = daysLeft !== null ? daysLeft <= 0 : false;
        const isExpiring = daysLeft !== null ? (daysLeft > 0 && daysLeft <= 7) : false;
        // Maskelenmiş lisans: ilk 4 ve son 4 karakter
        const maskedLicense =
          licenseData.licenseKey.slice(0, 4) + '-xxxx-' + licenseData.licenseKey.slice(-4);
        return {
          exists: true,
          maskedLicense,
          daysLeft,
          isExpired,
          isExpiring,
          expiresAt: licenseData.expiresAt,
        };
      } catch (error) {
        return { exists: false, error: 'Failed to retrieve license info' };
      }
    });
  }
}

export default LicenseManager;