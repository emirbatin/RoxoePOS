// hooks/useProductGroups.ts
import { useState, useEffect } from 'react';
import { ProductGroup } from '../types/product';
import { productService } from '../services/productDB';

export const useProductGroups = () => {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const dbGroups = await productService.getProductGroups();
      
      // Her grup için ürün ID'lerini al
      const groupsWithProducts = await Promise.all(
        dbGroups.map(async (group) => {
          const productIds = await productService.getGroupProducts(group.id);
          return {
            ...group,
            productIds
          };
        })
      );

      setGroups(groupsWithProducts);
    } catch (error) {
      console.error('Gruplar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const addGroup = async (name: string) => {
    try {
      const newGroup = await productService.addProductGroup(name);
      setGroups(prev => [...prev, { ...newGroup, productIds: [] }]);
      return newGroup;
    } catch (error) {
      console.error('Grup eklenirken hata:', error);
      throw error;
    }
  };

  const renameGroup = async (groupId: number, newName: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        const updatedGroup = { ...group, name: newName };
        await productService.updateProductGroup(updatedGroup);
        setGroups(prev =>
          prev.map(g => (g.id === groupId ? updatedGroup : g))
        );
      }
    } catch (error) {
      console.error('Grup adı değiştirilirken hata:', error);
      throw error;
    }
  };

  const addProductToGroup = async (groupId: number, productId: number) => {
    try {
      await productService.addProductToGroup(groupId, productId);
      setGroups(prev =>
        prev.map(group =>
          group.id === groupId
            ? { ...group, productIds: [...(group.productIds || []), productId] }
            : group
        )
      );
    } catch (error) {
      console.error('Ürün gruba eklenirken hata:', error);
      throw error;
    }
  };

  const removeProductFromGroup = async (groupId: number, productId: number) => {
    try {
      await productService.removeProductFromGroup(groupId, productId);
      setGroups(prev =>
        prev.map(group =>
          group.id === groupId
            ? { ...group, productIds: group.productIds?.filter(id => id !== productId) }
            : group
        )
      );
    } catch (error) {
      console.error('Ürün gruptan çıkarılırken hata:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  return {
    groups,
    loading,
    addGroup,
    renameGroup,
    addProductToGroup,
    removeProductFromGroup,
    refreshGroups: loadGroups
  };
};