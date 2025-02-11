import React from "react";
import clsx from "clsx";
import { AlertTriangle, Tag, Plus, Minus } from "lucide-react";

// components/ui/Card.tsx içinde
export type CardVariant = "default" | "stat" | "shadow" | "bordered" | "product" | "addProduct";

export interface CardProps {
  variant?: CardVariant;
  title?: string;
  value?: string | number;
  description?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: "primary" | "red" | "green" | "blue" | "orange";
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

const Card: React.FC<CardProps> = ({
  variant = "default",
  title,
  value,
  description,
  trend,
  trendLabel,
  icon,
  color = "primary",
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
          "flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-colors group",
          className
        )}
      >
        {icon || <Plus size={24} className="text-gray-400 group-hover:text-primary-500 mb-2" />}
        <span className="text-sm text-gray-600 group-hover:text-primary-600">{title || "Ürün Ekle"}</span>
      </button>
    );
  }

  if (variant === "product") {
    return (
      <div className={clsx(
        "relative group border rounded-lg hover:shadow-md transition-shadow",
        disabled && "opacity-50 cursor-not-allowed",
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
                className="p-1.5 bg-primary-500 text-white rounded-full hover:bg-primary-600"
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
                className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                title="Gruptan Çıkar"
              >
                <Minus size={14} />
              </button>
            )}
          </div>
        )}

        {/* Ürün İçeriği */}
        <button
          onClick={onClick}
          disabled={disabled}
          className="p-4 w-full text-left"
        >
          {/* Ürün Görseli */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-32 object-cover rounded mb-2"
            />
          )}
          
          {/* Ürün Bilgileri */}
          <div className="font-medium text-gray-900 truncate">{title}</div>
          {category && (
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Tag size={14} />
              {category}
            </div>
          )}
          
          {/* Fiyat ve KDV */}
          <div className="mt-2">
            {price && <div className="font-semibold text-primary-600">{price}</div>}
            {vatRate && (
              <div className="text-xs text-gray-500">+{vatRate} KDV</div>
            )}
          </div>
          
          {/* Stok Durumu */}
          {stock !== undefined && (
            <div
              className={clsx(
                "text-sm mt-1",
                stock < 5 ? "text-red-500" : "text-gray-500"
              )}
            >
              Stok: {stock}
              {stock < 5 && <AlertTriangle size={14} className="inline ml-1" />}
            </div>
          )}
        </button>
      </div>
    );
  }

  if (variant === "stat") {
    return (
      <div className={clsx(
        "bg-white rounded-lg p-6 border hover:border-gray-200 transition-colors h-full",
        className
      )}>
        {/* Üst Kısım - İkon ve Başlık */}
        <div className="flex items-center gap-3 mb-3">
          {icon && (
            <div className={clsx(
              "p-2 rounded-lg",
              {
                "bg-blue-50 text-blue-600": color === "blue",
                "bg-red-50 text-red-600": color === "red",
                "bg-green-50 text-green-600": color === "green",
                "bg-orange-50 text-orange-600": color === "orange",
                "bg-primary-50 text-primary-600": color === "primary",
              }
            )}>
              {icon}
            </div>
          )}
          <span className="text-md font-medium text-gray-600">{title}</span>
        </div>
  
        {/* Alt Kısım - Değer ve Trend yan yana */}
        <div className="flex items-baseline gap-3">
          {/* Ana Değer */}
          <div className="text-2xl font-bold text-gray-900">
            {value}
          </div>
  
          {/* Trend */}
          {trend !== undefined && (
            <div className={clsx(
              "text-sm font-medium",
              trend > 0 ? "text-green-600" : "text-red-600"
            )}>
              {trend > 0 ? "+" : ""}{trend}%
            </div>
          )}
        </div>
  
        {/* Açıklama - Ayrı satırda */}
        {description && (
          <div className="mt-1 text-sm text-gray-500">{description}</div>
        )}
      </div>
    );
  }

  // Diğer varyantlar için temel stil
  const baseStyle = clsx(
    "bg-white rounded-lg p-4 transition-all duration-200",
    {
      "shadow-lg hover:shadow-xl": variant === "shadow",
      "border border-gray-200": variant === "bordered",
      "shadow-sm": variant === "default",
    },
    className
  );

  return (
    <div className={baseStyle}>
      {title && (
        <div className="mb-4 flex items-center gap-2">
          {icon && <div>{icon}</div>}
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>
      )}
      {description && <div className="mb-4 text-gray-800">{description}</div>}
      {value && <div className="text-lg font-bold">{value}</div>}
    </div>
  );
};

export default Card;