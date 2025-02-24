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

declare global {
  interface Window {
    electron: IElectronAPI;
    serialAPI: {
      requestPort: () => Promise<any>;
      getPorts: () => Promise<any[]>;
    };
  }
}