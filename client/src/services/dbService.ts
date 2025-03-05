import { openDB } from 'idb';
import { encryptionService } from './encryptionService';
import DBVersionHelper from '../helpers/DBVersionHelper';

export const createEncryptedDB = (dbName: string) => {
  return {
    async add(storeName: string, data: any) {
      const db = await openDB(dbName, DBVersionHelper.getVersion(dbName), {
        upgrade(db, oldVersion, newVersion) {
          console.log(`Upgrading ${dbName} from ${oldVersion} to ${newVersion}`);
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            console.log(`Created ${storeName} store`);
          }
        },
      });
      const encryptedData = encryptionService.encrypt(data);
      return db.add(storeName, { data: encryptedData });
    },

    async get(storeName: string, id: number) {
      const db = await openDB(dbName, DBVersionHelper.getVersion(dbName));
      const result = await db.get(storeName, id);
      return result ? encryptionService.decrypt(result.data) : null;
    },

    async getAll(storeName: string) {
      const db = await openDB(dbName, DBVersionHelper.getVersion(dbName));
      const results = await db.getAll(storeName);
      return results.map(result => encryptionService.decrypt(result.data));
    },

    async put(storeName: string, data: any, id?: number) {
      const db = await openDB(dbName, DBVersionHelper.getVersion(dbName));
      const encryptedData = encryptionService.encrypt(data);
      return db.put(storeName, { data: encryptedData }, id);
    }
  };
};