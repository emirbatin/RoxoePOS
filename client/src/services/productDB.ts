// productDB.ts
import { openDB, IDBPDatabase } from "idb";
import { Product, Category } from "../types/product";

export interface ProductGroup {
  id: number;
  name: string;
  order: number;
  isDefault?: boolean;
}

export interface ProductGroupRelation {
  groupId: number;
  productId: number;
}

const DB_NAME = "posDB";
const DB_VERSION = 2;

export const initProductDB = async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      // Versiyon 1 store'ları
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains("products")) {
          const productStore = db.createObjectStore("products", {
            keyPath: "id",
            autoIncrement: true,
          });
          productStore.createIndex("barcode", "barcode", { unique: true });
        }
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      }

      // Versiyon 2 store'ları
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains("productGroups")) {
          const groupStore = db.createObjectStore("productGroups", {
            keyPath: "id",
            autoIncrement: true,
          });
          groupStore.createIndex("order", "order");

          // Varsayılan grubu ekle
          groupStore.add({
            name: "Tümü",
            order: 0,
            isDefault: true
          });
        }

        if (!db.objectStoreNames.contains("productGroupRelations")) {
          const relationStore = db.createObjectStore("productGroupRelations", {
            keyPath: ["groupId", "productId"]
          });
          relationStore.createIndex("groupId", "groupId");
          relationStore.createIndex("productId", "productId");
        }
      }
    },
  });
  return db;
};

export const productService = {
  async initializeWithSampleData(products: Product[], categories: Category[]) {
    const db = await initProductDB();
    const tx = db.transaction(["products", "categories"], "readwrite");

    try {
      for (const product of products) {
        await tx.objectStore("products").add(product);
      }
      for (const category of categories) {
        await tx.objectStore("categories").add(category);
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async getAllProducts(): Promise<Product[]> {
    const db = await initProductDB();
    return db.getAll("products");
  },

  async getProduct(id: number): Promise<Product | undefined> {
    const db = await initProductDB();
    return db.get("products", id);
  },

  async addProduct(product: Omit<Product, "id">): Promise<number> {
    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");

    try {
      const existingProduct = await tx.store.index("barcode").get(product.barcode);
      if (existingProduct) {
        throw new Error(`Bu barkoda sahip ürün zaten mevcut: ${product.barcode}`);
      }

      const id = await tx.store.add(product);
      
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      return id as number;
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async updateProduct(product: Product): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");
    
    try {
      await tx.store.put(product);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async deleteProduct(id: number): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction(["products", "productGroupRelations"], "readwrite");
    
    try {
      // Önce ürünün grup ilişkilerini sil
      const relationStore = tx.objectStore("productGroupRelations");
      const relations = await relationStore.index("productId").getAll(id);
      for (const relation of relations) {
        await relationStore.delete([relation.groupId, relation.productId]);
      }
      
      // Sonra ürünü sil
      await tx.objectStore("products").delete(id);

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async getCategories(): Promise<Category[]> {
    const db = await initProductDB();
    return db.getAll("categories");
  },

  async addCategory(category: Omit<Category, "id">): Promise<number> {
    const db = await initProductDB();
    const tx = db.transaction("categories", "readwrite");

    try {
      const store = tx.objectStore("categories");
      const categories = await store.getAll();
      const exists = categories.some(
        (c) => c.name.toLowerCase() === category.name.toLowerCase()
      );

      if (exists) {
        throw new Error(`${category.name} kategorisi zaten mevcut`);
      }

      const id = await store.add(category);
      
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      return id as number;
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async updateCategory(category: Category): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("categories", "readwrite");
    
    try {
      await tx.store.put(category);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async deleteCategory(id: number): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction(["products", "categories"], "readwrite");

    try {
      const store = tx.objectStore("products");
      const products = await store.getAll();
      const categoryStore = tx.objectStore("categories");
      const categoryToDelete = await categoryStore.get(id);

      if (!categoryToDelete) {
        throw new Error("Silinecek kategori bulunamadı");
      }

      for (const product of products) {
        if (product.category === categoryToDelete.name) {
          product.category = "Genel";
          await store.put(product);
        }
      }

      await categoryStore.delete(id);
      
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async updateStock(id: number, quantity: number): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");
    
    try {
      const product = await tx.store.get(id);
      if (product) {
        product.stock += quantity;
        await tx.store.put(product);
      }
      
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async bulkInsertProducts(products: Product[]): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");

    try {
      for (const product of products) {
        const { id, ...productData } = product;
        const existing = await tx.store.index("barcode").get(productData.barcode);

        if (existing) {
          await tx.store.put({ ...productData, id: existing.id });
        } else {
          await tx.store.add(productData);
        }
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async getProductGroups(): Promise<ProductGroup[]> {
    const db = await initProductDB();
    return db.getAllFromIndex("productGroups", "order");
  },

  async addProductGroup(name: string): Promise<ProductGroup> {
    const db = await initProductDB();
    const tx = db.transaction("productGroups", "readwrite");
    
    try {
      const groups = await tx.store.getAll();
      const order = Math.max(...groups.map(g => g.order), -1) + 1;
      
      const id = await tx.store.add({
        name,
        order,
        isDefault: false
      });

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      return {
        id: id as number,
        name,
        order,
        isDefault: false
      };
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async updateProductGroup(group: ProductGroup): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("productGroups", "readwrite");
    
    try {
      await tx.store.put(group);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async deleteProductGroup(id: number): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction(["productGroups", "productGroupRelations"], "readwrite");
    
    try {
      const group = await tx.objectStore("productGroups").get(id);
      if (group?.isDefault) {
        throw new Error("Varsayılan grup silinemez");
      }

      const relationStore = tx.objectStore("productGroupRelations");
      const relations = await relationStore.index("groupId").getAll(id);
      for (const relation of relations) {
        await relationStore.delete([relation.groupId, relation.productId]);
      }

      await tx.objectStore("productGroups").delete(id);
      
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async addProductToGroup(groupId: number, productId: number): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("productGroupRelations", "readwrite");
    
    try {
      await tx.store.add({
        groupId,
        productId
      });
      
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      if ((error as Error).name === 'ConstraintError') {
        return; // İlişki zaten varsa hata fırlatma
      }
      tx.abort();
      throw error;
    }
  },

  async removeProductFromGroup(groupId: number, productId: number): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("productGroupRelations", "readwrite");
    
    try {
      await tx.store.delete([groupId, productId]);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  },

  async getGroupProducts(groupId: number): Promise<number[]> {
    const db = await initProductDB();
    const relations = await db.getAllFromIndex("productGroupRelations", "groupId", groupId);
    return relations.map(r => r.productId);
  }
};