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
    return db.add("products", product) as Promise<number>;
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
    return db.add("categories", category) as Promise<number>;
  },

  async updateCategory(category: Category): Promise<void> {
    const db = await initProductDB();
    await db.put("categories", category);
  },

  async deleteCategory(id: number, defaultCategoryId: number): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction(["products", "categories"], "readwrite");

    const products = await tx.objectStore("products").getAll();
    for (const product of products) {
      if (product.categoryId === id) {
        product.categoryId = defaultCategoryId;
        await tx.objectStore("products").put(product);
      }
    }

    await tx.objectStore("categories").delete(id);
    await tx.done;
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
    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.store;
  
    for (const product of products) {
      const existingProduct = await store.get(product.id);
  
      if (existingProduct) {
        // Güncelleme yap
        await store.put({ ...existingProduct, ...product });
      } else {
        // Yeni ürün ekle
        await store.add(product);
      }
    }
  
    await tx.done;
  },

  async bulkInsertCategories(categories: Category[]): Promise<void> {
    const db = await initProductDB();
    const tx = db.transaction("categories", "readwrite");
    for (const category of categories) {
      await tx.store.add(category);
    }
    await tx.done;
  },
};
