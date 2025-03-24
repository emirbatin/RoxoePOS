/**
 * Veriyi .roxoe formatına dönüştürecek modül
 */

import { CompressionUtils } from '../utils/compressionUtils';
import { ChecksumUtils } from '../utils/checksumUtils';

// Yedek meta veri tipini tanımlama
export interface BackupMetadata {
  version: string;
  appVersion: string;
  createdAt: string;
  description: string;
  databases: string[];
  recordCounts: Record<string, number>;
  licenseInfo?: {
    licenseId: string;
  };
  backupType: 'full' | 'incremental';
  dataFormat: 'compressed' | 'raw';
  compressionMethod: string;
  checksum?: string;
}

export class BackupSerializer {
  /**
   * Veriyi .roxoe formatına dönüştürür
   * 
   * @param data Serileştirilecek veri
   * @param metadata Yedek meta verileri
   * @returns .roxoe formatında serileştirilmiş veri
   */
  serializeToRoxoeFormat(data: any, metadata: Partial<BackupMetadata>): string {
    // Veriyi JSON formatına dönüştür
    const jsonData = JSON.stringify(data);
    
    // Veriyi sıkıştır
    const compressedData = CompressionUtils.compress(jsonData);
    
    // Veri bütünlüğü için checksum hesapla
    const checksum = ChecksumUtils.calculateSHA256(compressedData);
    
    // Meta verileri hazırla
    const metaData: BackupMetadata = {
      version: '1.0',
      appVersion: metadata.appVersion || 'Roxoe POS v1.0',
      createdAt: new Date().toISOString(),
      description: metadata.description || 'Otomatik Yedekleme',
      databases: metadata.databases || [],
      recordCounts: metadata.recordCounts || {},
      backupType: metadata.backupType || 'full',
      dataFormat: 'compressed',
      compressionMethod: 'lz-string',
      checksum: checksum,
      ...metadata
    };
    
    // Meta veriyi JSON formatına dönüştür
    const metaJson = JSON.stringify(metaData);
    
    // Meta veri uzunluğunu 4 byte olarak hazırla
    const metaLength = metaJson.length;
    const metaLengthBytes = new Uint8Array(4);
    metaLengthBytes[0] = metaLength & 0xff;
    metaLengthBytes[1] = (metaLength >> 8) & 0xff;
    metaLengthBytes[2] = (metaLength >> 16) & 0xff;
    metaLengthBytes[3] = (metaLength >> 24) & 0xff;
    
    // Meta veri uzunluğu ve meta veriyi birleştir
    const metaLengthStr = String.fromCharCode.apply(null, Array.from(metaLengthBytes));
    
    // Roxoe formatını oluştur: [4 byte - Header Length] + [Header JSON] + [Compressed Data]
    return metaLengthStr + metaJson + compressedData;
  }
  
  /**
   * Veriyi sıkıştırma
   * 
   * @param data Sıkıştırılacak veri
   * @returns Sıkıştırılmış veri
   */
  compressData(data: string): string {
    return CompressionUtils.compress(data);
  }
  
  /**
   * Veri bütünlüğü için kontrol değeri hesaplama
   * 
   * @param data Kontrol değeri hesaplanacak veri
   * @returns Checksum değeri
   */
  calculateChecksum(data: string): string {
    return ChecksumUtils.calculateSHA256(data);
  }
}