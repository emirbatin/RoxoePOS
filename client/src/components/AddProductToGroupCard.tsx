// components/AddProductToGroupCard.tsx
import React from 'react';
import { Plus } from 'lucide-react';

interface AddProductToGroupCardProps {
  onAdd: () => void;
}

const AddProductToGroupCard: React.FC<AddProductToGroupCardProps> = ({ onAdd }) => {
  return (
    <button
      onClick={onAdd}
      className="flex flex-col items-center justify-center h-full aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-colors group"
    >
      <Plus size={24} className="text-gray-400 group-hover:text-primary-500 mb-2" />
      <span className="text-sm text-gray-600 group-hover:text-primary-600">Ürün Ekle</span>
    </button>
  );
};

export default AddProductToGroupCard;