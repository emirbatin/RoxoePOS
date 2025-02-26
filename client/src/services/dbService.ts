import { openDB } from 'idb';
import { encryptionService } from './encryptionService';

const DB_VERSION = 2;

export const createEncryptedDB = (dbName: string) => {
  return {
    async add(storeName: string, data: any) {
      const db = await openDB(dbName, DB_VERSION);
      const encryptedData = encryptionService.encrypt(data);
      return db.add(storeName, { data: encryptedData });
    },

    async get(storeName: string, id: number) {
      const db = await openDB(dbName, DB_VERSION);
      const result = await db.get(storeName, id);
      return result ? encryptionService.decrypt(result.data) : null;
    },

    async getAll(storeName: string) {
      const db = await openDB(dbName, DB_VERSION);
      const results = await db.getAll(storeName);
      return results.map(result => encryptionService.decrypt(result.data));
    },

    async put(storeName: string, data: any, id?: number) {
      const db = await openDB(dbName, DB_VERSION);
      const encryptedData = encryptionService.encrypt(data);
      return db.put(storeName, { data: encryptedData }, id);
    }
  };
};

// Kullanımı:
export const productsDB = createEncryptedDB('productDB');
