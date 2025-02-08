import React, { useState } from "react";
import { Plus, Edit2, Trash2, AlertTriangle, X } from "lucide-react";
import { Category } from "../types/product";
import { productService } from "../services/productDB";

interface CategoryManagementProps {
  categories: Category[];
  onUpdate: (categories: Category[]) => void;
  onClose: () => void;
}

const EMOJI_LIST = [
  "🏪",
  "🥤",
  "🍪",
  "🥛",
  "🥖",
  "🧀",
  "🍎",
  "🥩",
  "🥗",
  "🥘",
  "🍜",
  "🍱",
  "🥫",
  "🍬",
  "📦",
  "🧻",
  "🧼",
  "🧴",
];

const CategoryManagement: React.FC<CategoryManagementProps> = ({
  categories,
  onUpdate,
  onClose,
}) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    name: "",
    icon: "🏷️",
  });
  const [error, setError] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newCategory.name?.trim()) {
      setError("Kategori adı boş olamaz");
      return;
    }

    const nameExists = categories.some(
      (cat) =>
        cat.name.toLowerCase() === newCategory.name?.toLowerCase() &&
        (!editingCategory || cat.id !== editingCategory.id)
    );

    if (nameExists) {
      setError("Bu isimde bir kategori zaten var");
      return;
    }

    if (editingCategory) {
      const updatedCategory = { ...editingCategory, ...newCategory };
      await productService.updateCategory(updatedCategory);
      onUpdate(
        categories.map((cat) =>
          cat.id === editingCategory.id ? updatedCategory : cat
        )
      );
    } else {
      const id = await productService.addCategory({
        name: newCategory.name!,
        icon: newCategory.icon || "🏷️",
      });
      onUpdate([
        ...categories,
        { id, name: newCategory.name!, icon: newCategory.icon || "🏷️" },
      ]);
    }

    setNewCategory({ name: "", icon: "🏷️" });
    setEditingCategory(null);
    setShowForm(false);
  };

  const handleDelete = async (category: Category) => {
    if (category.name === "Tümü" || category.name === "Genel") {
      setError("Varsayılan kategori silinemez");
      return;
    }

    const confirmed = window.confirm(
      `"${category.name}" kategorisini silmek istediğinize emin misiniz?\n` +
        'Bu kategorideki ürünler "Genel" kategorisine taşınacaktır.'
    );

    if (confirmed) {
      try {
        await productService.deleteCategory(category.id);
        onUpdate(categories.filter((c) => c.id !== category.id));
      } catch (error) {
        setError("Kategori silinirken bir hata oluştu.");
        console.error("Kategori silme hatası:", error);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 shadow-xl transition-all sm:w-full sm:max-w-lg">
          <div className="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500"
              onClick={onClose}
            >
              <span className="sr-only">Kapat</span>
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">
                Kategori Yönetimi
              </h3>

              <div className="mt-4 grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-2 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </div>

                    {category.name !== "Tümü" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setNewCategory(category);
                            setShowForm(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Edit2 size={16} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 flex items-center gap-2 px-3 py-2 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 w-full justify-center"
                >
                  <Plus size={16} />
                  Yeni Kategori
                </button>
              )}

              {showForm && (
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Kategori Adı
                    </label>
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={(e) =>
                        setNewCategory({ ...newCategory, name: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Kategori adı girin..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İkon
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {EMOJI_LIST.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() =>
                            setNewCategory({ ...newCategory, icon: emoji })
                          }
                          className={`w-10 h-10 flex items-center justify-center border rounded-lg text-xl
                            ${
                              newCategory.icon === emoji
                                ? "border-primary-500 bg-primary-50"
                                : "hover:bg-gray-50"
                            }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                      <AlertTriangle size={20} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingCategory(null);
                        setNewCategory({ name: "", icon: "🏷️" });
                      }}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      {editingCategory ? "Güncelle" : "Ekle"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagement;
