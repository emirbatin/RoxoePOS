// components/ProductGroupTabs.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit2, Minus } from 'lucide-react';
import { ProductGroup } from '../services/productDB';

interface ProductGroupTabsProps {
  groups: ProductGroup[];
  activeGroupId: number;
  onGroupChange: (groupId: number) => void;
  onAddGroup: () => void;
  onRenameGroup: (groupId: number, newName: string) => void;
  onDeleteGroup?: (groupId: number) => void;
}

const ProductGroupTabs: React.FC<ProductGroupTabsProps> = ({
  groups,
  activeGroupId,
  onGroupChange,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup
}) => {
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [shakingGroupId, setShakingGroupId] = useState<number | null>(null);
  const [showDeleteButton, setShowDeleteButton] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<NodeJS.Timeout>();
  const [isLongPress, setIsLongPress] = useState(false);

  useEffect(() => {
    if (editingGroupId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingGroupId]);

  const handleMouseDown = (groupId: number, isDefault: boolean) => {
    if (isDefault) return; // Varsayılan grup için çalışmasın
    
    pressTimer.current = setTimeout(() => {
      setShakingGroupId(groupId);
      setShowDeleteButton(groupId);
      setIsLongPress(true);
    }, 500);
  };

  const handleMouseUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, groupId: number, isDefault: boolean) => {
    e.preventDefault();
    if (isDefault) return; // Varsayılan grup için çalışmasın
    
    setShakingGroupId(groupId);
    setShowDeleteButton(groupId);
  };

  const handleDoubleClick = (group: ProductGroup) => {
    if (!group.isDefault) {
      setEditingGroupId(group.id);
      setEditingName(group.name);
    }
  };

  const handleEditSubmit = () => {
    if (editingGroupId && editingName.trim()) {
      onRenameGroup(editingGroupId, editingName.trim());
    }
    setEditingGroupId(null);
  };

  // Click olayı sonrası reset ediyoruz
  const handleClick = (groupId: number) => {
    if (!isLongPress) {
      onGroupChange(groupId);
    }
    setIsLongPress(false);
  };

  // "Yeni Grup" butonuna tıklama işleyicisi
  const handleAddGroupClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      console.log("Add group button clicked");
      onAddGroup();
    } catch (error) {
      console.error("Add group button click error:", error);
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 mb-4 bg-white rounded-lg shadow-sm overflow-x-auto">
      {groups.map((group) => (
        <div
          key={group.id}
          onMouseDown={() => handleMouseDown(group.id, !!group.isDefault)}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => handleContextMenu(e, group.id, !!group.isDefault)}
          onDoubleClick={() => !group.isDefault && handleDoubleClick(group)}
          className={`relative group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all
            ${activeGroupId === group.id
              ? 'bg-primary-50 text-primary-600'
              : 'hover:bg-gray-50 text-gray-700'
            }
            ${shakingGroupId === group.id ? 'animate-shake' : ''}
          `}
          onClick={() => handleClick(group.id)}
        >
          {editingGroupId === group.id ? (
            <input
              ref={inputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSubmit();
                if (e.key === 'Escape') setEditingGroupId(null);
              }}
              className="w-32 px-2 py-1 text-sm border rounded bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span>{group.name}</span>
              {showDeleteButton === group.id && !group.isDefault && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeleteGroup) {
                      onDeleteGroup(group.id);
                      setShakingGroupId(null);
                      setShowDeleteButton(null);
                      setIsLongPress(false);
                    }
                  }}
                  className="absolute right-0 p-1 bg-red-500 text-white rounded-full transform -translate-y-1/2 translate-x-1/2 hover:bg-red-600"
                >
                  <Minus size={14} />
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <button
        onClick={handleAddGroupClick}
        className="p-2 rounded-lg hover:bg-gray-50 text-primary-600"
        title="Yeni Grup"
        id="addGroupButton" // ID ekleyerek DOM'da kolay erişim sağlıyoruz
      >
        <Plus size={20} />
      </button>
    </div>
  );
};

export default ProductGroupTabs;