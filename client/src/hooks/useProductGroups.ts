// hooks/useProductGroups.ts
import { useState, useEffect } from 'react';
import { ProductGroup } from '../types/product';
import { productService } from '../services/productDB';

export const useProductGroups = () => {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Loading product groups...");
      const dbGroups = await productService.getProductGroups();
      console.log("Loaded groups from DB:", dbGroups);
      
      // Her grup için ürün ID'lerini al
      const groupsWithProducts = await Promise.all(
        dbGroups.map(async (group) => {
          console.log(`Loading products for group: ${group.id} (${group.name})`);
          try {
            const productIds = await productService.getGroupProducts(group.id);
            console.log(`Group ${group.id} has ${productIds.length} products`);
            return {
              ...group,
              productIds
            };
          } catch (err) {
            console.error(`Error loading products for group ${group.id}:`, err);
            return {
              ...group,
              productIds: []
            };
          }
        })
      );

      // NOT: Burada ikinci bir "Tümü" grubu ekleme mantığını kaldırdık
      // Varsayılan grup zaten veritabanı başlatılırken ekleniyor

      console.log("Setting groups with products:", groupsWithProducts);
      setGroups(groupsWithProducts);
    } catch (err) {
      console.error('Gruplar yüklenirken hata:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  const addGroup = async (name: string): Promise<ProductGroup> => {
    try {
      console.log(`Adding new group with name: "${name}"`);
      
      // Show temporary loading state if needed
      setLoading(true);
      
      const newGroup = await productService.addProductGroup(name);
      console.log("New group created:", newGroup);
      
      // Update local state
      const groupWithProducts = {
        ...newGroup,
        productIds: [] as number[]
      };
      
      setGroups(prev => [...prev, groupWithProducts]);
      console.log("Groups state updated with new group");
      
      return newGroup;
    } catch (err) {
      console.error(`Grup "${name}" eklenirken hata:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const renameGroup = async (groupId: number, newName: string) => {
    try {
      console.log(`Renaming group ${groupId} to "${newName}"`);
      const group = groups.find(g => g.id === groupId);
      if (!group) {
        throw new Error(`Group with id ${groupId} not found`);
      }
      
      const updatedGroup = { ...group, name: newName };
      console.log("Updating group:", updatedGroup);
      
      await productService.updateProductGroup(updatedGroup);
      console.log("Group renamed successfully in DB");
      
      setGroups(prev =>
        prev.map(g => (g.id === groupId ? {...g, name: newName} : g))
      );
      console.log("Groups state updated with renamed group");
    } catch (err) {
      console.error(`Grup ${groupId} adı değiştirilirken hata:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const addProductToGroup = async (groupId: number, productId: number) => {
    try {
      console.log(`Adding product ${productId} to group ${groupId}`);
      
      // Grubun varsayılan olup olmadığını kontrol et
      const group = groups.find(g => g.id === groupId);
      if (group?.isDefault) {
        console.log("Cannot add products to default group");
        return; // Varsayılan gruba ürün eklenemez
      }
      
      await productService.addProductToGroup(groupId, productId);
      console.log("Product added to group in DB");
      
      setGroups(prev =>
        prev.map(group =>
          group.id === groupId
            ? { 
                ...group, 
                productIds: [...(group.productIds || []), productId] 
              }
            : group
        )
      );
      console.log("Groups state updated with new product relation");
    } catch (err) {
      console.error(`Ürün ${productId} gruba ${groupId} eklenirken hata:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const removeProductFromGroup = async (groupId: number, productId: number) => {
    try {
      console.log(`Removing product ${productId} from group ${groupId}`);
      
      // Grubun varsayılan olup olmadığını kontrol et
      const group = groups.find(g => g.id === groupId);
      if (group?.isDefault) {
        console.log("Cannot remove products from default group");
        return; // Varsayılan gruptan ürün çıkarılamaz
      }
      
      await productService.removeProductFromGroup(groupId, productId);
      console.log("Product removed from group in DB");
      
      setGroups(prev =>
        prev.map(group =>
          group.id === groupId
            ? { 
                ...group, 
                productIds: group.productIds?.filter(id => id !== productId) || [] 
              }
            : group
        )
      );
      console.log("Groups state updated after product removal");
    } catch (err) {
      console.error(`Ürün ${productId} gruptan ${groupId} çıkarılırken hata:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  // Component mount edildiğinde grupları yükle
  useEffect(() => {
    console.log("useProductGroups hook initialized, loading groups...");
    loadGroups();
  }, []);

  return {
    groups,
    loading,
    error,
    addGroup,
    renameGroup,
    addProductToGroup,
    removeProductFromGroup,
    refreshGroups: loadGroups
  };
};