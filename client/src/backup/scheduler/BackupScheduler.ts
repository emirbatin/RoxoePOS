/**
 * Otomatik yedeklemeyi yönetecek zamanlayıcı
 */

import { BackupManager } from '../core/BackupManager';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface BackupSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  hour: number;
  minute: number;
  dayOfWeek?: number; // 0-6 (Pazar-Cumartesi)
  dayOfMonth?: number; // 1-31
  intervalMinutes?: number; // Özel aralık için (dakika cinsinden)
  lastBackup?: string; // ISO tarih formatı
  enabled: boolean;
  description?: string;
}

export class BackupScheduler {
  private backupManager: BackupManager;
  private schedule: BackupSchedule | null = null;
  private checkInterval: number = 60000; // 1 dakikalık kontrol
  private intervalId: NodeJS.Timeout | null = null;
  private configFilePath: string;
  
  constructor(backupManager: BackupManager) {
    this.backupManager = backupManager;
    
    // Uygulama veri dizininde yapılandırma dosyası yolu
    this.configFilePath = path.join(
      app.getPath('userData'),
      'backup-schedule.json'
    );
    
    this.loadSchedule();
  }
  
  /**
   * Zamanlamayı başlatır
   */
  startScheduling(): void {
    if (this.intervalId) {
      this.stopScheduling();
    }
    
    // Zamanlama ayarlarını yükle
    this.loadSchedule();
    
    // Zamanlama etkin değilse çık
    if (!this.schedule || !this.schedule.enabled) {
      console.log('Otomatik yedekleme devre dışı');
      return;
    }
    
    console.log('Otomatik yedekleme zamanlayıcı başlatıldı');
    
    // Düzenli aralıklarla yedekleme zamanını kontrol et
    this.intervalId = setInterval(() => {
      this.checkScheduledBackup();
    }, this.checkInterval);
    
    // İlk kontrolü hemen yap
    this.checkScheduledBackup();
  }
  
  /**
   * Zamanlamayı durdurur
   */
  stopScheduling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Otomatik yedekleme zamanlayıcı durduruldu');
    }
  }
  
  /**
   * Belirli bir zamanda yedekleme ayarlar
   * @param config Zamanlama ayarları
   */
  scheduleBackup(config: BackupSchedule): void {
    this.schedule = config;
    this.saveSchedule();
    
    // Aktif ise zamanlayıcıyı yeniden başlat
    if (config.enabled) {
      this.startScheduling();
    } else {
      this.stopScheduling();
    }
  }
  
  /**
   * Otomatik yedeklemeyi etkinleştirir
   * @param frequency Yedekleme sıklığı
   * @param hour Yedekleme saati
   * @param minute Yedekleme dakikası
   */
  enableAutoBackup(
    frequency: BackupSchedule['frequency'] = 'daily',
    hour: number = 3,
    minute: number = 0
  ): void {
    const config: BackupSchedule = {
      frequency,
      hour,
      minute,
      enabled: true,
      description: `${frequency} yedekleme - ${hour}:${minute < 10 ? '0' + minute : minute}`
    };
    
    if (frequency === 'weekly') {
      config.dayOfWeek = 0; // Pazar
    } else if (frequency === 'monthly') {
      config.dayOfMonth = 1; // Ayın 1'i
    } else if (frequency === 'custom') {
      config.intervalMinutes = 60; // Varsayılan olarak saatlik
    }
    
    this.scheduleBackup(config);
  }
  
  /**
   * Otomatik yedeklemeyi devre dışı bırakır
   */
  disableAutoBackup(): void {
    if (this.schedule) {
      this.schedule.enabled = false;
      this.saveSchedule();
      this.stopScheduling();
    }
  }
  
  /**
   * Son yedek zamanını kontrol eder
   */
  checkLastBackup(): Date | null {
    if (this.schedule?.lastBackup) {
      return new Date(this.schedule.lastBackup);
    }
    return null;
  }
  
  /**
   * Zamanlanmış yedekleme kontrolü
   */
  public async checkScheduledBackup(): Promise<void> {
    if (!this.schedule || !this.schedule.enabled) {
      return;
    }
    
    const now = new Date();
    const lastBackup = this.schedule.lastBackup ? new Date(this.schedule.lastBackup) : null;
    
    // Hiç yedek alınmamışsa veya zamanı geldiyse yedek al
    if (!lastBackup || this.isBackupDue(lastBackup, now)) {
      try {
        console.log('Otomatik yedekleme başlatılıyor...');
        await this.backupManager.createBackup({
          description: `Otomatik Yedekleme - ${this.schedule.frequency}`,
          backupType: 'full',
          isAutoBackup: true
        });
        
        // Son yedek zamanını güncelle
        this.schedule.lastBackup = now.toISOString();
        this.saveSchedule();
        
        console.log('Otomatik yedekleme tamamlandı');
      } catch (error) {
        console.error('Otomatik yedekleme hatası:', error);
      }
    }
  }
  
  /**
   * Yedekleme zamanının gelip gelmediğini kontrol eder
   * @param lastBackup Son yedekleme zamanı
   * @param now Şu anki zaman
   * @returns Yedekleme zamanı geldi mi
   */
  private isBackupDue(lastBackup: Date, now: Date): boolean {
    if (!this.schedule) {
      return false;
    }
    
    const { frequency, hour, minute, dayOfWeek, dayOfMonth, intervalMinutes } = this.schedule;
    
    // Özel aralıklı yedekleme kontrolü
    if (frequency === 'custom' && intervalMinutes) {
      const diffMs = now.getTime() - lastBackup.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      return diffMinutes >= intervalMinutes;
    }
    
    // Günlük, haftalık ve aylık yedekleme kontrolü
    
    // Günün belirli saati geldi mi?
    const isTimeReached = now.getHours() >= hour && 
                         (now.getHours() > hour || now.getMinutes() >= minute);
    
    // Son yedekleme bugün mü yapıldı?
    const isSameDay = lastBackup.getDate() === now.getDate() && 
                     lastBackup.getMonth() === now.getMonth() && 
                     lastBackup.getFullYear() === now.getFullYear();
    
    // Günlük yedekleme
    if (frequency === 'daily') {
      return isTimeReached && !isSameDay;
    }
    
    // Haftalık yedekleme
    if (frequency === 'weekly' && dayOfWeek !== undefined) {
      return now.getDay() === dayOfWeek && isTimeReached && 
             (lastBackup.getDay() !== dayOfWeek || 
              now.getTime() - lastBackup.getTime() > 6 * 24 * 60 * 60 * 1000);
    }
    
    // Aylık yedekleme
    if (frequency === 'monthly' && dayOfMonth !== undefined) {
      return now.getDate() === dayOfMonth && isTimeReached && 
             (lastBackup.getDate() !== dayOfMonth || 
              lastBackup.getMonth() !== now.getMonth() || 
              lastBackup.getFullYear() !== now.getFullYear());
    }
    
    return false;
  }
  
  /**
   * Zamanlama ayarlarını dosyaya kaydeder
   */
  private saveSchedule(): void {
    if (this.schedule) {
      try {
        fs.writeFileSync(
          this.configFilePath,
          JSON.stringify(this.schedule),
          'utf8'
        );
      } catch (error) {
        console.error('Yedekleme zamanlaması kaydedilemedi:', error);
      }
    }
  }
  
  /**
   * Zamanlama ayarlarını dosyadan yükler
   */
  private loadSchedule(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf8');
        this.schedule = JSON.parse(data);
      }
    } catch (error) {
      console.error('Yedekleme zamanlaması yüklenemedi:', error);
      this.schedule = null;
    }
  }
}