// hooks/useProducts.ts

import { useState, useEffect, useMemo } from "react";
import { Product, Category } from "../types/product";
import { productService } from "../services/productDB";
import { normalizedSearch } from "../utils/turkishSearch";

/**
 * @param options.enableCategories Eğer true ise kategorileri de çekiyor.
 * @param options.initialSearch Eğer bir başlangıç arama terimi vermek isterseniz.
 */
interface UseProductsOptions {
  enableCategories?: boolean;
  initialSearch?: string;
}

export function useProducts(options?: UseProductsOptions) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Basit filtreleme için
  const [searchTerm, setSearchTerm] = useState(options?.initialSearch || "");
  const [selectedCategory, setSelectedCategory] = useState("Tümü");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const dbProducts = await productService.getAllProducts();
        setProducts(dbProducts);

        if (options?.enableCategories) {
          const dbCategories = await productService.getCategories();
          setCategories(dbCategories);
        }
      } catch (error) {
        console.error("Ürünler yüklenirken hata:", error);
      }
      setLoading(false);
    };
    loadData();
  }, [options?.enableCategories]);

  /**
   * Filtrelenmiş ürün listesi
   * (searchTerm, selectedCategory değiştikçe yeniden hesaplanır)
   */
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        normalizedSearch(product.name, searchTerm) ||
        product.barcode.includes(searchTerm);
  
      const matchesCategory =
        selectedCategory === "Tümü" || product.category === selectedCategory;
  
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  /**
   * Ürünleri tekrar sunucudan (veya IndexedDB'den) çekmek için
   */
  async function refreshProducts() {
    try {
      setLoading(true);
  
      // Ürünleri tekrar çek
      const dbProducts = await productService.getAllProducts();
      setProducts(dbProducts);
  
      // Kategorileri tekrar çek (eğer enableCategories aktifse)
      if (options?.enableCategories) {
        const dbCategories = await productService.getCategories();
        setCategories(dbCategories);
      }
  
      setLoading(false);
    } catch (error) {
      console.error("Ürünler ve kategoriler yenilenirken hata:", error);
      setLoading(false);
    }
  }

  return {
    products,
    categories,
    loading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    filteredProducts,
    refreshProducts,
  };
}