// productDB.ts
import { openDB, IDBPDatabase } from "idb";
import { Product, Category } from "../types/product";
import initUnifiedPOSDB from './UnifiedDBInitializer';

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

// Veritabanını sıfırlama fonksiyonu
export const resetDatabases = async (): Promise<boolean> => {
  console.log("Veritabanları sıfırlanıyor...");
  
  try {
    // Tüm bilinen veritabanlarını sil
    await Promise.all([
      indexedDB.deleteDatabase(DB_NAME),
      indexedDB.deleteDatabase("productDB"), // Eski adlandırma
      indexedDB.deleteDatabase("salesDB"), 
      indexedDB.deleteDatabase("creditDB")
    ]);
    
    console.log("Veritabanları başarıyla silindi");
    return true;
  } catch (error) {
    console.error("Veritabanı sıfırlama hatası:", error);
    return false;
  }
};

export const initProductDB = async () => {
  try {
    // Zorla sıfırlama kontrolü
    const forceReset = localStorage.getItem('db_force_reset');
    if (forceReset === 'true') {
      console.log("Zorla sıfırlama talep edildi");
      await resetDatabases();
      localStorage.removeItem('db_force_reset');
    }
    
    // Birleştirilmiş veritabanı başlatma fonksiyonunu kullan
    const db = await initUnifiedPOSDB();
    
    // Veritabanı yapısının doğru olduğunu kontrol et
    try {
      // Test transaction - beklenen tüm store'ları içeren bir transaction oluştur
      const testTx = db.transaction(["products", "categories", "productGroups", "productGroupRelations"], "readonly");
      testTx.abort(); // Sadece test amaçlı, işlemi iptal et
      console.log("Database structure verified successfully");
    } catch (error) {
      console.error("Invalid database structure detected:", error);
      // Bir sonraki sayfa yenileme için sıfırlama işareti koy
      localStorage.setItem('db_force_reset', 'true');
      console.log("Bir sonraki sayfa yüklemesinde veritabanı sıfırlanacak");
      
      throw new Error("Veritabanı yapısı geçersiz, yeniden yükleniyor...");
    }

    // Tüm grupları kontrol et
    const productGroups = await db.getAll("productGroups");
    console.log("Checking existing groups:", productGroups);

    // Eğer hiç grup yoksa veya varsayılan grup yoksa ekle
    if (
      productGroups.length === 0 ||
      !productGroups.some((g) => g.isDefault === true)
    ) {
      console.log("Default group 'Tümü' not found, adding it");
      const tx = db.transaction("productGroups", "readwrite");
      await tx.store.add({
        name: "Tümü",
        order: 0,
        isDefault: true,
      });
      await tx.done;
    }
    // Eğer birden fazla varsayılan grup varsa, fazlasını sil
    else if (productGroups.filter((g) => g.isDefault === true).length > 1) {
      console.log("Multiple default groups found, fixing...");
      const tx = db.transaction("productGroups", "readwrite");
      const store = tx.objectStore("productGroups");

      // Varsayılan grupları bul
      const defaultGroups = productGroups.filter((g) => g.isDefault === true);
      console.log("Default groups:", defaultGroups);

      // İlki hariç diğerlerini sil
      for (let i = 1; i < defaultGroups.length; i++) {
        console.log(`Deleting extra default group: ${defaultGroups[i].id}`);
        await store.delete(defaultGroups[i].id);
      }

      await tx.done;
      console.log("Fixed default groups");
    }

    console.log("Database initialized successfully");
    return db;
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
};

// Hata durumunda veritabanını sıfırlama ve sayfayı yeniden yükleme
export const repairDatabase = async () => {
  try {
    await resetDatabases();
    
    // DB sürüm yükseltme işareti koy (yeni)
    localStorage.setItem('db_version_upgraded', 'true');
    
    console.log("Veritabanı başarıyla sıfırlandı, sayfa yenileniyor...");
    window.location.reload();
    return true;
  } catch (error) {
    console.error("Veritabanı onarım hatası:", error);
    return false;
  }
};

type StockChangeCallback = (product: Product) => void;
let stockChangeCallbacks: StockChangeCallback[] = [];

export const emitStockChange = (product: Product) => {
  stockChangeCallbacks.forEach((callback) => callback(product));
};

export const productService = {
  onStockChange(callback: StockChangeCallback) {
    stockChangeCallbacks.push(callback);
  },

  offStockChange(callback: StockChangeCallback) {
    stockChangeCallbacks = stockChangeCallbacks.filter((cb) => cb !== callback);
  },

  async getAllProducts(): Promise<Product[]> {
    try {
      console.log("Getting all products");
      const db = await initProductDB();
      const products = await db.getAll("products");
      console.log(`Retrieved ${products.length} products`);
      return products;
    } catch (error) {
      console.error("Error getting all products:", error);
      throw error;
    }
  },

  async getProduct(id: number): Promise<Product | undefined> {
    try {
      console.log(`Getting product with id: ${id}`);
      const db = await initProductDB();
      const product = await db.get("products", id);
      console.log(`Retrieved product:`, product ? "Found" : "Not found");
      return product;
    } catch (error) {
      console.error(`Error getting product with id ${id}:`, error);
      throw error;
    }
  },

  async addProduct(product: Omit<Product, "id">): Promise<number> {
    console.log("Adding product:", product.name);
    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");

    try {
      const existingProduct = await tx.store
        .index("barcode")
        .get(product.barcode);
      if (existingProduct) {
        console.error(`Product with barcode ${product.barcode} already exists`);
        throw new Error(
          `Bu barkoda sahip ürün zaten mevcut: ${product.barcode}`
        );
      }

      const id = await tx.store.add(product);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`Product added successfully with id: ${id}`);
          resolve(id);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });

      return id as number;
    } catch (error) {
      console.error("Error in add product transaction:", error);
      tx.abort();
      throw error;
    }
  },

  async updateProduct(product: Product): Promise<void> {
    console.log("Updating product:", product.id, product.name);
    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");

    try {
      await tx.store.put(product);
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`Product updated successfully: ${product.id}`);
          resolve(undefined);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error("Error in update product transaction:", error);
      tx.abort();
      throw error;
    }
  },

  async deleteProduct(id: number): Promise<void> {
    console.log(`Deleting product with id: ${id}`);
    const db = await initProductDB();
    const tx = db.transaction(
      ["products", "productGroupRelations"],
      "readwrite"
    );

    try {
      // Önce ürünün grup ilişkilerini sil
      const relationStore = tx.objectStore("productGroupRelations");
      const relations = await relationStore.index("productId").getAll(id);
      console.log(`Found ${relations.length} group relations to delete`);

      for (const relation of relations) {
        await relationStore.delete([relation.groupId, relation.productId]);
      }

      // Sonra ürünü sil
      await tx.objectStore("products").delete(id);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`Product and its relations deleted successfully: ${id}`);
          resolve(undefined);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error("Error in delete product transaction:", error);
      tx.abort();
      throw error;
    }
  },

  async getCategories(): Promise<Category[]> {
    try {
      console.log("Getting all categories");
      const db = await initProductDB();
      const categories = await db.getAll("categories");
      console.log(`Retrieved ${categories.length} categories`);
      return categories;
    } catch (error) {
      console.error("Error getting categories:", error);
      throw error;
    }
  },

  async addCategory(category: Omit<Category, "id">): Promise<number> {
    console.log("Adding category:", category.name);
    const db = await initProductDB();
    const tx = db.transaction("categories", "readwrite");

    try {
      const store = tx.objectStore("categories");
      const categories = await store.getAll();
      const exists = categories.some(
        (c) => c.name.toLowerCase() === category.name.toLowerCase()
      );

      if (exists) {
        console.error(`Category ${category.name} already exists`);
        throw new Error(`${category.name} kategorisi zaten mevcut`);
      }

      const id = await store.add(category);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`Category added successfully with id: ${id}`);
          resolve(id);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });

      return id as number;
    } catch (error) {
      console.error("Error in add category transaction:", error);
      tx.abort();
      throw error;
    }
  },

  async updateCategory(category: Category): Promise<void> {
    console.log("Updating category:", category.id, category.name);
    const db = await initProductDB();
    const tx = db.transaction("categories", "readwrite");

    try {
      await tx.store.put(category);
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`Category updated successfully: ${category.id}`);
          resolve(undefined);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error("Error in update category transaction:", error);
      tx.abort();
      throw error;
    }
  },

  async deleteCategory(id: number): Promise<void> {
    console.log(`Deleting category with id: ${id}`);
    const db = await initProductDB();
    const tx = db.transaction(["products", "categories"], "readwrite");

    try {
      const store = tx.objectStore("products");
      const products = await store.getAll();
      const categoryStore = tx.objectStore("categories");
      const categoryToDelete = await categoryStore.get(id);

      if (!categoryToDelete) {
        console.error(`Category with id ${id} not found`);
        throw new Error("Silinecek kategori bulunamadı");
      }

      console.log(
        `Updating products that use category: ${categoryToDelete.name}`
      );
      for (const product of products) {
        if (product.category === categoryToDelete.name) {
          product.category = "Genel";
          await store.put(product);
        }
      }

      await categoryStore.delete(id);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`Category deleted successfully: ${id}`);
          resolve(undefined);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error("Error in delete category transaction:", error);
      tx.abort();
      throw error;
    }
  },

  async updateStock(id: number, quantity: number): Promise<void> {
    try {
      console.log(`Updating stock for product ${id} by ${quantity}`);
      const db = await initProductDB();
      const tx = db.transaction("products", "readwrite");

      const product = await tx.store.get(id);
      if (product) {
        product.stock += quantity;
        await tx.store.put(product);
        console.log(`Updated stock for ${product.name} to ${product.stock}`);

        emitStockChange(product);
      } else {
        console.error(`Product with id ${id} not found for stock update`);
      }

      await tx.done;
    } catch (error) {
      console.error(`Error updating stock for product ${id}:`, error);
      throw error;
    }
  },

  async bulkInsertProducts(products: Product[]): Promise<void> {
    console.log(`Bulk inserting ${products.length} products`);
    const db = await initProductDB();
    const tx = db.transaction("products", "readwrite");

    try {
      for (const product of products) {
        const { id, ...productData } = product;
        const existing = await tx.store
          .index("barcode")
          .get(productData.barcode);

        if (existing) {
          console.log(
            `Updating existing product with barcode ${productData.barcode}`
          );
          await tx.store.put({ ...productData, id: existing.id });
        } else {
          console.log(`Adding new product: ${productData.name}`);
          await tx.store.add(productData);
        }
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log("Bulk insert completed successfully");
          resolve(undefined);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error("Error in bulk insert transaction:", error);
      tx.abort();
      throw error;
    }
  },

  async getProductGroups(): Promise<ProductGroup[]> {
    try {
      console.log("Getting all product groups");
      const db = await initProductDB();
      const groups = await db.getAllFromIndex("productGroups", "order");
      console.log(`Retrieved ${groups.length} product groups`);
      return groups;
    } catch (error) {
      console.error("Error getting product groups:", error);
      throw error;
    }
  },

  async addProductGroup(name: string): Promise<ProductGroup> {
    console.log(`Adding product group: ${name}`);
    const db = await initProductDB();
    const tx = db.transaction("productGroups", "readwrite");

    try {
      const groups = await tx.store.getAll();
      console.log(`Current groups count: ${groups.length}`);
      const order = Math.max(...groups.map((g) => g.order), -1) + 1;
      console.log(`New group order: ${order}`);

      const newGroup = {
        name,
        order,
        isDefault: false,
      };

      const id = await tx.store.add(newGroup);
      console.log(`Group added with id: ${id}`);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`Product group added successfully: ${name} (id: ${id})`);
          resolve(undefined);
        };
        tx.onerror = (event) => {
          console.error("Transaction error:", tx.error);
          console.error("Error event:", event);
          reject(tx.error);
        };
      });

      const result = {
        id: id as number,
        name,
        order,
        isDefault: false,
      };

      console.log("Returning new group:", result);
      return result;
    } catch (error) {
      console.error(`Error in add product group transaction (${name}):`, error);
      tx.abort();
      throw error;
    }
  },

  async updateProductGroup(group: ProductGroup): Promise<void> {
    console.log(`Updating product group: ${group.id}, ${group.name}`);
    const db = await initProductDB();
    const tx = db.transaction("productGroups", "readwrite");

    try {
      // Varsayılan grubun özelliklerini değiştirmesine izin verme
      if (group.isDefault) {
        const originalGroup = await tx.store.get(group.id);
        if (originalGroup && originalGroup.isDefault) {
          // Sadece isim değişikliğine izin ver, diğer özellikleri koru
          originalGroup.name = group.name;
          await tx.store.put(originalGroup);
        }
      } else {
        await tx.store.put(group);
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`Product group updated successfully: ${group.id}`);
          resolve(undefined);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error(
        `Error in update product group transaction (${group.id}):`,
        error
      );
      tx.abort();
      throw error;
    }
  },

  async deleteProductGroup(id: number): Promise<void> {
    console.log(`Deleting product group with id: ${id}`);
    const db = await initProductDB();
    const tx = db.transaction(
      ["productGroups", "productGroupRelations"],
      "readwrite"
    );

    try {
      const group = await tx.objectStore("productGroups").get(id);
      if (!group) {
        console.error(`Group with id ${id} not found`);
        throw new Error("Silinecek grup bulunamadı");
      }

      if (group.isDefault) {
        console.error("Cannot delete default group");
        throw new Error("Varsayılan grup silinemez");
      }

      // İlişkileri silme
      const relationStore = tx.objectStore("productGroupRelations");
      const relations = await relationStore.index("groupId").getAll(id);
      console.log(`Found ${relations.length} relations to delete`);

      for (const relation of relations) {
        await relationStore.delete([relation.groupId, relation.productId]);
      }

      // Grubu silme
      await tx.objectStore("productGroups").delete(id);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(
            `Product group and relations deleted successfully: ${id}`
          );
          resolve(undefined);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error(
        `Error in delete product group transaction (${id}):`,
        error
      );
      tx.abort();
      throw error;
    }
  },

  async addProductToGroup(groupId: number, productId: number): Promise<void> {
    console.log(`Adding product ${productId} to group ${groupId}`);
    const db = await initProductDB();
    const tx = db.transaction(
      ["productGroups", "productGroupRelations"],
      "readwrite"
    );

    try {
      // Önce grubun varsayılan grup olmadığını kontrol et
      const group = await tx.objectStore("productGroups").get(groupId);
      if (!group) {
        throw new Error(`Group with id ${groupId} not found`);
      }

      if (group.isDefault) {
        console.log(`Cannot add products to default group ${groupId}`);
        return; // Varsayılan gruba ürün eklenemez
      }

      const relation = {
        groupId,
        productId,
      };

      await tx.objectStore("productGroupRelations").add(relation);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(
            `Product ${productId} added to group ${groupId} successfully`
          );
          resolve(undefined);
        };
        tx.onerror = () => {
          // ConstraintError'u normal durum olarak ele al
          if (tx.error && tx.error.name === "ConstraintError") {
            console.log(`Product ${productId} is already in group ${groupId}`);
            resolve(undefined);
          } else {
            console.error("Transaction error:", tx.error);
            reject(tx.error);
          }
        };
      });
    } catch (error) {
      if ((error as Error).name === "ConstraintError") {
        console.log(`Product ${productId} is already in group ${groupId}`);
        return; // İlişki zaten varsa hata fırlatma
      }
      console.error(
        `Error adding product ${productId} to group ${groupId}:`,
        error
      );
      tx.abort();
      throw error;
    }
  },

  async removeProductFromGroup(
    groupId: number,
    productId: number
  ): Promise<void> {
    console.log(`Removing product ${productId} from group ${groupId}`);
    const db = await initProductDB();
    const tx = db.transaction(
      ["productGroups", "productGroupRelations"],
      "readwrite"
    );

    try {
      // Önce grubun varsayılan grup olmadığını kontrol et
      const group = await tx.objectStore("productGroups").get(groupId);
      if (!group) {
        throw new Error(`Group with id ${groupId} not found`);
      }

      if (group.isDefault) {
        console.log(`Cannot remove products from default group ${groupId}`);
        return; // Varsayılan gruptan ürün çıkarılamaz
      }

      await tx
        .objectStore("productGroupRelations")
        .delete([groupId, productId]);
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(
            `Product ${productId} removed from group ${groupId} successfully`
          );
          resolve(undefined);
        };
        tx.onerror = () => {
          console.error("Transaction error:", tx.error);
          reject(tx.error);
        };
      });
    } catch (error) {
      console.error(
        `Error removing product ${productId} from group ${groupId}:`,
        error
      );
      tx.abort();
      throw error;
    }
  },

  async getGroupProducts(groupId: number): Promise<number[]> {
    try {
      console.log(`Getting products for group ${groupId}`);
      const db = await initProductDB();

      // Varsayılan grupsa, bütün ürünleri çekme
      const group = await db.get("productGroups", groupId);
      if (group && group.isDefault) {
        console.log(
          "Default group, returning empty product list as all products are included by default"
        );
        return [];
      }

      const relations = await db.getAllFromIndex(
        "productGroupRelations",
        "groupId",
        groupId
      );
      const productIds = relations.map((r) => r.productId);
      console.log(`Found ${productIds.length} products in group ${groupId}`);
      return productIds;
    } catch (error) {
      console.error(`Error getting products for group ${groupId}:`, error);
      throw error;
    }
  },
};