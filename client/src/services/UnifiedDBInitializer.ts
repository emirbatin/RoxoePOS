// src/helpers/UnifiedDBInitializer.ts - veya - src/services/UnifiedDBInitializer.ts
import { openDB } from "idb";
import DBVersionHelper from "../helpers/DBVersionHelper"; // Import yolunu projenize göre ayarlayın

// Tüm servislerden gerekli sabitler (bunlar ilgili dosyalardan alınmalı)
const POS_DB_NAME = "posDB";

/**
 * POS veritabanını tek bir seferde başlatma ve tüm store'ları oluşturma
 */
export const initUnifiedPOSDB = async () => {
  // Güncel sürüm numarasını al
  const dbVersion = DBVersionHelper.getVersion(POS_DB_NAME);
  console.log(`Initializing unified ${POS_DB_NAME} database, version ${dbVersion}`);
  
  // Sürüm yükseltme işaretini temizle
  DBVersionHelper.clearUpgradeFlag();
  
  return openDB(POS_DB_NAME, dbVersion, {
    upgrade(db, oldVersion, newVersion) {
      console.log(`Upgrading ${POS_DB_NAME} database from ${oldVersion} to ${newVersion || "unknown"}`);
      
      // Ürün veritabanı store'ları
      if (!db.objectStoreNames.contains("products")) {
        const productStore = db.createObjectStore("products", {
          keyPath: "id",
          autoIncrement: true,
        });
        productStore.createIndex("barcode", "barcode", { unique: true });
        console.log("Created products store");
      }
      
      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", {
          keyPath: "id",
          autoIncrement: true,
        });
        console.log("Created categories store");
      }
      
      if (!db.objectStoreNames.contains("productGroups")) {
        const groupStore = db.createObjectStore("productGroups", {
          keyPath: "id",
          autoIncrement: true,
        });
        groupStore.createIndex("order", "order");
        console.log("Created product groups store");
        
        // "Tümü" adında varsayılan grup ekleniyor
        const defaultGroup = {
          name: "Tümü",
          order: 0,
          isDefault: true,
        };
        groupStore.add(defaultGroup);
        console.log("Added default group:", defaultGroup);
      }
      
      if (!db.objectStoreNames.contains("productGroupRelations")) {
        const relationStore = db.createObjectStore(
          "productGroupRelations",
          {
            keyPath: ["groupId", "productId"],
          }
        );
        relationStore.createIndex("groupId", "groupId");
        relationStore.createIndex("productId", "productId");
        console.log("Created product group relations store");
      }
      
      // Kasa yönetimi store'ları
      if (!db.objectStoreNames.contains("cashRegisterSessions")) {
        const sessionStore = db.createObjectStore("cashRegisterSessions", {
          keyPath: "id",
        });
        sessionStore.createIndex("status", "status");
        console.log("Created cash register sessions store");
      }
      
      if (!db.objectStoreNames.contains("cashTransactions")) {
        const transactionStore = db.createObjectStore("cashTransactions", {
          keyPath: "id",
        });
        transactionStore.createIndex("sessionId", "sessionId");
        console.log("Created cash transactions store");
      }
    },
  });
};

export default initUnifiedPOSDB;