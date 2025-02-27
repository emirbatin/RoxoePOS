import React from "react";
import clsx from "clsx";
import { ShoppingCart, AlertTriangle, Tag, Plus, Minus } from "lucide-react";

export interface CardProps {
  variant?: "product" | "addProduct";
  title?: string;
  imageUrl?: string;
  category?: string;
  price?: string;
  vatRate?: string;
  stock?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  onAddToGroup?: () => void;
  onRemoveFromGroup?: () => void;
}

const NeonProductCard: React.FC<CardProps> = ({
  variant = "product",
  title,
  imageUrl,
  category,
  price,
  vatRate,
  stock,
  onClick,
  disabled,
  className,
  onAddToGroup,
  onRemoveFromGroup,
}) => {
  if (variant === "addProduct") {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "flex flex-col items-center justify-center h-full rounded-xl border-2 border-dashed transition-all duration-300",
          "bg-gradient-to-br from-blue-900 to-purple-900 border-blue-500/50 hover:border-blue-400",
          "hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]",
          className
        )}
      >
        <div className="p-6 flex flex-col items-center gap-2">
          <Plus size={28} className="text-blue-300" />
          <span className="text-sm font-medium text-blue-200">Ürün Ekle</span>
        </div>
      </button>
    );
  }

  // Stok durumuna göre renk belirleme
  const stockStatusColor = 
    stock === undefined ? "bg-gray-400" :
    stock === 0 ? "from-red-600 to-red-800" : 
    stock < 5 ? "from-orange-600 to-orange-800" : 
    "from-green-600 to-green-800";

  return (
    <div className={clsx(
      "relative group overflow-hidden rounded-xl transition-all duration-300 h-full",
      "border border-transparent hover:border-blue-400/50",
      "bg-gradient-to-br from-blue-900 to-purple-900",
      "hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]",
      disabled && "opacity-60 grayscale cursor-not-allowed",
      className
    )}>
      {/* Grup İşlem Butonları */}
      {(onAddToGroup || onRemoveFromGroup) && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {onAddToGroup && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToGroup();
              }}
              className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.7)]"
              title="Gruba Ekle"
            >
              <Plus size={14} />
            </button>
          )}
          {onRemoveFromGroup && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFromGroup();
              }}
              className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.7)]"
              title="Gruptan Çıkar"
            >
              <Minus size={14} />
            </button>
          )}
        </div>
      )}

      {/* Stok Durumu İşareti - Daha belirgin glow ile */}
      {stock !== undefined && (
        <div className={clsx(
          "absolute top-3 right-3 w-3 h-3 rounded-full z-10",
          `bg-gradient-to-br ${stockStatusColor}`,
          "shadow-[0_0_8px_rgba(255,255,255,0.5)]"
        )} title={`Stok: ${stock}`} />
      )}

      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full h-full flex flex-col outline-none focus:outline-none relative"
      >
        {/* Resim Alanı - Overlay ile */}
        <div className="w-full aspect-square overflow-hidden relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title || "Ürün"}
              className="w-full h-full object-cover brightness-90 group-hover:brightness-110 group-hover:scale-105 transition-all duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-800/80 to-purple-900/80">
              <div className="text-blue-200 flex flex-col items-center">
                <Tag size={36} className="mb-2 opacity-40" />
                <span className="text-sm opacity-60">Resim Yok</span>
              </div>
            </div>
          )}
          
          {/* Kategori - Parlak neon efektli */}
          {category && (
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium bg-blue-900/70 text-blue-200 backdrop-blur-sm border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
              {category}
            </div>
          )}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-transparent pointer-events-none" />
        </div>
        
        {/* Ürün bilgileri - Altta, transparan bir panel içinde */}
        <div className="absolute inset-x-0 bottom-0 p-4 backdrop-blur-sm bg-gradient-to-t from-blue-900/90 to-blue-900/60">
          {/* Ürün Adı */}
          <h3 className="text-white font-medium leading-tight line-clamp-2">
            {title || "İsimsiz Ürün"}
          </h3>
          
          {/* Stok Bilgisi */}
          {stock !== undefined && (
            <div className="mt-1 text-xs flex items-center gap-1 text-blue-200">
              Stok: <span className={clsx(
                stock === 0 ? "text-red-300 font-medium" : 
                stock < 5 ? "text-orange-300 font-medium" : 
                "text-green-300 font-medium"
              )}>{stock}</span>
              {stock < 5 && stock > 0 && <AlertTriangle size={12} className="text-orange-300" />}
              {stock === 0 && <span className="text-red-300 font-medium">Tükendi</span>}
            </div>
          )}
          
          {/* Fiyat Bilgisi - Neon efekti ile */}
          <div className="mt-2 flex justify-between items-center">
            <div className="flex flex-col">
              {price && (
                <div className="font-bold text-lg text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]">
                  {price}
                </div>
              )}
              {vatRate && (
                <div className="text-xs text-blue-300">
                  +{vatRate} KDV
                </div>
              )}
            </div>
            
            {/* Sepete Ekle Butonu - Neon efekti */}
            <div className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center",
              disabled 
                ? "bg-gray-700/50 text-gray-400" 
                : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:shadow-[0_0_15px_rgba(99,102,241,0.7)]"
            )}>
              <ShoppingCart size={16} />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};

export default NeonProductCard;