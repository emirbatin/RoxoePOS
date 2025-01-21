import { Product, Category } from '../types/pos';
import { calculatePriceWithVat } from '../utils/vatUtils';

// Örnek kategoriler
export const categories: Category[] = [
  { id: 1, name: "Tümü", icon: "🏪" },
  { id: 2, name: "İçecekler", icon: "🥤" },
  { id: 3, name: "Atıştırmalık", icon: "🍪" },
  { id: 4, name: "Süt Ürünleri", icon: "🥛" },
  { id: 5, name: "Temel Gıda", icon: "🥖" },
  { id: 6, name: "Şarküteri", icon: "🧀" },
];

// Örnek ürünler
export const sampleProducts: Product[] = [
  {
    id: 1,
    name: "Cola 1L",
    price: 13.55,        // KDV'siz fiyat
    vatRate: 18,         // %18 KDV
    priceWithVat: 15.99, // KDV'li fiyat
    category: "İçecekler",
    stock: 24,
    barcode: "8690000000001"
  },
  {
    id: 2,
    name: "Ekmek",
    price: 7.43,        // KDV'siz fiyat
    vatRate: 1,         // %1 KDV
    priceWithVat: 7.50, // KDV'li fiyat
    category: "Temel Gıda",
    stock: 50,
    barcode: "8690000000002"
  },
  {
    id: 3,
    name: "Süt 1L",
    price: 23.06,        // KDV'siz fiyat
    vatRate: 8,          // %8 KDV
    priceWithVat: 24.90, // KDV'li fiyat
    category: "Süt Ürünleri",
    stock: 15,
    barcode: "8690000000003"
  },
  {
    id: 4,
    name: "Çikolata",
    price: 10.59,        // KDV'siz fiyat
    vatRate: 18,         // %18 KDV
    priceWithVat: 12.50, // KDV'li fiyat
    category: "Atıştırmalık",
    stock: 30,
    barcode: "8690000000004"
  },
  {
    id: 5,
    name: "Peynir 500g",
    price: 51.76,        // KDV'siz fiyat
    vatRate: 8,          // %8 KDV
    priceWithVat: 55.90, // KDV'li fiyat
    category: "Şarküteri",
    stock: 8,
    barcode: "8690000000005"
  },
  {
    id: 6,
    name: "Maden Suyu",
    price: 5.08,        // KDV'siz fiyat
    vatRate: 18,        // %18 KDV
    priceWithVat: 5.99, // KDV'li fiyat
    category: "İçecekler",
    stock: 3,
    barcode: "8690000000006"
  },
  {
    id: 7,
    name: "Cips",
    price: 15.68,        // KDV'siz fiyat
    vatRate: 18,         // %18 KDV
    priceWithVat: 18.50, // KDV'li fiyat
    category: "Atıştırmalık",
    stock: 45,
    barcode: "8690000000007"
  },
  {
    id: 8,
    name: "Yoğurt 1kg",
    price: 30.46,        // KDV'siz fiyat
    vatRate: 8,          // %8 KDV
    priceWithVat: 32.90, // KDV'li fiyat
    category: "Süt Ürünleri",
    stock: 12,
    barcode: "8690000000008"
  }
];