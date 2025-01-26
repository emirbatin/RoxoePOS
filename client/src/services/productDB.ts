// productDB.ts
import { openDB } from "idb";
import { Product, Category } from "../types/pos";

const DB_NAME = "posDB";
const DB_VERSION = 1;

export const initProductDB = async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
    },
  });
  return db;
};

export const productService = {
  async initializeWithSampleData(products: Product[], categories: Category[]) {
    const db = await initProductDB();
    const tx = db.transaction(["products", "categories"], "readwrite");

    for (const product of products) {
      await tx.objectStore("products").add(product);
    }
    for (const category of categories) {
      await tx.objectStore("categories").add(category);
    }

    await tx.done;
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

    // Barkod kontrolü
    const existingProduct = await tx.store
      .index("barcode")
      .get(product.barcode);
    if (existingProduct) {
      throw new Error(`Bu barkoda sahip ürün zaten mevcut: ${product.barcode}`);
    }

    const id = await tx.store.add(product);
    await tx.done;
    return id as number;
  },

  async updateProduct(product: Product): Promise<void> {
    const db = await initProductDB();
    await db.put("products", product);
  },

  async deleteProduct(id: number): Promise<void> {
    const db = await initProductDB();
    await db.delete("products", id);
  },

  async getCategories(): Promise<Category[]> {
    const db = await initProductDB();
    return db.getAll("categories");
  },

  async addCategory(category: Omit<Category, "id">): Promise<number> {
    const db = await initProductDB();
    const tx = db.transaction(["categories"], "readwrite");

    try {
      // Kategori adı kontrolü
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
        tx.oncomplete = () => resolve(undefined);
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
    await db.put("categories", category);
  },

  // productDB.ts içinde
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

      // Ürünleri güncelle
      for (const product of products) {
        if (product.category === categoryToDelete.name) {
          product.category = "Genel";
          await store.put(product);
        }
      }

      // Kategoriyi sil
      await categoryStore.delete(id);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
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
    const product = await tx.store.get(id);
    if (product) {
      product.stock += quantity;
      await tx.store.put(product);
    }
    await tx.done;
  },

  async bulkInsertProducts(products: Product[]): Promise<void> {
    console.log("İçe aktarılacak ürünler:", products); // Debug için

    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");

    try {
      for (const product of products) {
        const { id, ...productData } = product;

        // Barkod kontrolü
        const existing = await store.index("barcode").get(productData.barcode);

        if (existing) {
          await store.put({ ...productData, id: existing.id });
        } else {
          await store.add(productData);
        }
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error);
        };
      });
    } catch (error) {
      throw error;
    }
  },

  async bulkInsertCategories(categories: Category[]): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("categories", "readwrite");
    for (const category of categories) {
      await tx.store.add(category);
    }
    await tx.done;
  },

  async getTransaction() {
    const db = await initProductDB();
    return db.transaction("products", "readwrite");
  },

  async addOrUpdateProduct(product: Omit<Product, "id">, tx?: IDBTransaction) {
    const db = await initProductDB();
    const transaction = tx || db.transaction("products", "readwrite");
    const store = transaction.objectStore("products");

    try {
      const index = store.index("barcode");
      const existing = await index.get(product.barcode);

      if (existing) {
        await store.put({
          ...product,
          id: existing.id,
        });
      } else {
        await store.add(product);
      }

      if (!tx) {
        await new Promise((resolve, reject) => {
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
        });
      }
    } catch (error) {
      if (!tx) {
        transaction.abort();
      }
      throw error;
    }
  },
};
