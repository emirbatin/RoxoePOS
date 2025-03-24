// Mevcut tanımlar
interface Navigator {
  serial: {
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  };
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface IElectronAPI {
  invoke(channel: 'check-license'): Promise<{
    isValid: boolean;
    error?: string;
  }>;
  invoke(channel: 'activate-license', licenseKey: string): Promise<{
    success: boolean;
    error?: string;
  }>;
}

// Yeni BackupAPI tipi
interface BackupAPI {
  createBackup(options: { description?: string, backupType?: string }): Promise<{
    success: boolean;
    backupId: string;
    metadata: any;
    error?: string;
    filename?: string;
  }>;
  
  restoreBackup(content: string, options?: { clearExisting?: boolean }): Promise<{
    success: boolean;
    error?: string;
    metadata?: any;
  }>;
  
  getBackupHistory(): Promise<any[]>;
  
  readBackupFile(): Promise<{ name: string, content: string }>;
  
  scheduleBackup(frequency: string, hour?: number, minute?: number): Promise<boolean>;
  
  disableScheduledBackup(): Promise<boolean>;
  
  onBackupProgress(callback: (data: { stage: string, percent: number }) => void): void;
  
  offBackupProgress(callback: (data: { stage: string, percent: number }) => void): void;
}

// Updater API için tip
interface UpdaterAPI {
  checkForUpdates(): void;
  onUpdateAvailable(callback: (info: any) => void): void;
  onUpdateDownloaded(callback: (info: any) => void): void;
  onUpdateError(callback: (err: any) => void): void;
  onUpdateMessage(callback: (message: string) => void): void;
  onUpdateProgress(callback: (progressObj: any) => void): void;
  onUpdateStatus(callback: (statusObj: any) => void): void;
  testUpdateAvailable(): void;
  testUpdateDownloaded(): void;
  testUpdateError(): void;
}

// Electron IPC tipi için ortak interface
interface IpcRenderer {
  on(channel: string, listener: (...args: any[]) => void): void;
  off(channel: string, listener: (...args: any[]) => void): void;
  send(channel: string, ...args: any[]): void;
  invoke(channel: string, ...args: any[]): Promise<any>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
    serialAPI: {
      requestPort: () => Promise<any>;
      getPorts: () => Promise<any[]>;
    };
    // Yeni eklenen API'ler
    backupAPI: BackupAPI;
    updaterAPI: UpdaterAPI;
    ipcRenderer: IpcRenderer;
  }
}