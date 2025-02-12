// hooks/useCustomers.ts

import { useState, useEffect } from "react";
import { creditService } from "../services/creditServices";
import { Customer } from "../types/credit";

/**
 * Müşteri listesi çekme, ekleme, silme, güncelleme vs. gibi işlemleri
 * ortak bir yerden yönetmek için custom hook.
 */
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadCustomers() {
    setLoading(true);
    try {
      const allCustomers = await creditService.getAllCustomers();
      setCustomers(allCustomers);
    } catch (error) {
      console.error("Müşteriler yüklenirken hata:", error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  // Müşteri ekle
  async function addCustomer(data: Omit<Customer, "id" | "currentDebt" | "createdAt">) {
    try {
      const newCustomer = await creditService.addCustomer(data);
      setCustomers((prev) => [...prev, newCustomer]);
      return newCustomer;
    } catch (error) {
      console.error("Müşteri eklenirken hata:", error);
      throw error;
    }
  }

  // Müşteri güncelle
  async function updateCustomer(customerId: number, data: Partial<Customer>) {
    try {
      const updated = await creditService.updateCustomer(customerId, data);
      if (updated) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === customerId ? updated : c))
        );
      }
      return updated;
    } catch (error) {
      console.error("Müşteri güncellenirken hata:", error);
      throw error;
    }
  }

  // Müşteri sil
  async function deleteCustomer(customerId: number) {
    try {
      const success = await creditService.deleteCustomer(customerId);
      if (success) {
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      }
      return success;
    } catch (error) {
      console.error("Müşteri silinirken hata:", error);
      throw error;
    }
  }

  return {
    customers,
    loading,
    loadCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
  };
}