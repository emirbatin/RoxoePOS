/**
 * Yedekleme sisteminin ana modülü
 */

// Core
export { BackupManager } from './core/BackupManager';
export type { BackupOptions, RestoreOptions, BackupResult } from './core/BackupManager';
export { BackupSerializer } from './core/BackupSerializer';
export type { BackupMetadata } from './core/BackupSerializer';
export { BackupDeserializer } from './core/BackupDeserializer';
export type { DeserializedBackup } from './core/BackupDeserializer';

// Database
export { IndexedDBExporter } from './database/IndexedDBExporter';
export type { DatabaseExportInfo, ExportResult } from './database/IndexedDBExporter';
export { IndexedDBImporter } from './database/IndexedDBImporter';
export type { ImportResult, ImportOptions } from './database/IndexedDBImporter';

// Scheduler
export { BackupScheduler } from './scheduler/BackupScheduler';
export type { BackupSchedule } from './scheduler/BackupScheduler';

// Utils
export { ChecksumUtils } from './utils/checksumUtils';
export { CompressionUtils } from './utils/compressionUtils';
export { FileUtils } from './utils/fileUtils';

// Singleton yedekleme yöneticisi oluştur
import { BackupManager } from './core/BackupManager';
export const backupManager = new BackupManager();
