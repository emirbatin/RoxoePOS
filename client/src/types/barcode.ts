// barcode.ts
export interface BarcodeConfig {
    type: string;
    baudRate: number;
    enabled: boolean;
    prefix?: string;
    suffix?: string;
  }
  
  export type BarcodeType = 'USB HID' | 'USB COM' | 'PS/2';
  
  export interface BarcodeEvent {
    barcode: string;
    timestamp: number;
  }