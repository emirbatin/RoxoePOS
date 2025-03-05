import React from "react";
import clsx from "clsx";
import { AlertTriangle, Tag, Plus, Minus, Image, ShoppingCart, Percent } from "lucide-react";

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
  size?: "normal" | "small"; // Size prop'u
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
  size = "normal", // Varsayılan olarak normal
}) => {
  if (variant === "addProduct") {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-colors group h-full",
          className
        )}
      >
        {icon || <Plus size={size === "small" ? 24 : 28} className="text-gray-400 group-hover:text-primary-500 mb-2" />}
        <span className={clsx(
          "font-medium text-gray-600 group-hover:text-primary-600",
          size === "small" ? "text-sm" : "text-sm"
        )}>{title || "Ürün Ekle"}</span>
      </button>
    );
  }

  if (variant === "product") {
    // Stok durumuna göre renk belirleme - stock undefined ise varsayılan olarak gri kullan
    const stockStatusColor = 
      stock === undefined ? "bg-gray-400" :
      stock === 0 ? "bg-red-500" : 
      stock < 5 ? "bg-orange-500" : 
      "bg-green-500";

    return (
      <div className={clsx(
        "relative group overflow-hidden rounded-xl transition-all duration-300 h-full flex flex-col",
        "border border-gray-100 hover:border-primary-200 bg-white hover:shadow-md",
        disabled && "opacity-50 cursor-not-allowed grayscale",
        size === "small" ? "text-sm" : "text-sm", // Küçük boyut için yazı boyutu normal ile aynı yaptık
        className
      )}>
        {/* Grup İşlem Butonları */}
        {(onAddToGroup || onRemoveFromGroup) && (
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            {onAddToGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToGroup();
                }}
                className={clsx(
                  "bg-primary-500 text-white rounded-full hover:bg-primary-600 shadow-sm",
                  size === "small" ? "p-1.5" : "p-1.5" // Padding boyutunu küçük kartlarda da normal yapıyoruz
                )}
                title="Gruba Ekle"
              >
                <Plus size={size === "small" ? 12 : 14} />
              </button>
            )}
            {onRemoveFromGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromGroup();
                }}
                className={clsx(
                  "bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm",
                  size === "small" ? "p-1.5" : "p-1.5" // Padding boyutunu küçük kartlarda da normal yapıyoruz
                )}
                title="Gruptan Çıkar"
              >
                <Minus size={size === "small" ? 12 : 14} />
              </button>
            )}
          </div>
        )}

        {/* Stok Durumu İşareti */}
        <div className={clsx(
          "absolute top-0 right-0 rounded-full",
          stockStatusColor,
          size === "small" ? "w-2 h-2 m-1.5" : "w-2 h-2 m-2" // Biraz daha büyük yapıyoruz
        )} title={`Stok: ${stock ?? 'Belirtilmemiş'}`} />

        {/* Ürün İçeriği */}
        <button
          onClick={onClick}
          disabled={disabled}
          className="w-full h-full text-left outline-none focus:outline-none flex flex-col"
        >
          {/* Resim Alanı - Küçük boyut için height artırıldı */}
          <div className={clsx(
            "w-full overflow-hidden bg-gray-50 relative",
            size === "small" ? "h-24" : "aspect-square" // Yüksekliği 16'dan 24'e çıkardık
          )}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title || "Ürün"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <Image size={size === "small" ? 30 : 36} className="text-gray-300" strokeWidth={1} />
              </div>
            )}
            
            {/* KDV Bilgisi Etiketi */}
            {vatRate && (
              <div className={clsx(
                "absolute bottom-1 left-1 bg-gray-800 bg-opacity-70 text-white rounded-md flex items-center gap-1",
                size === "small" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs" // Font boyutunu ve padding'i artırdık
              )}>
                {vatRate} KDV
              </div>
            )}
            
            {/* Kategori Etiketi */}
            {category && (
              <div className={clsx(
                "absolute top-1 left-1 bg-primary-100 text-primary-700 rounded-md",
                size === "small" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs" // Font boyutunu ve padding'i artırdık
              )}>
                {category}
              </div>
            )}
          </div>

          {/* Ürün Bilgileri */}
          <div className={clsx(
            "flex-1 flex flex-col",
            size === "small" ? "p-2" : "p-3" // Padding'i biraz artırdık
          )}>
            {/* Ürün Adı */}
            <h3 className={clsx(
              "font-medium text-gray-800 line-clamp-2",
              size === "small" ? "text-sm line-clamp-2" : "" // Font boyutunu text-xs'den text-sm'e yükselttik, line-clamp 2 satır
            )}>
              {title || "İsimsiz Ürün"}
            </h3>
            
            {/* Stok Bilgisi - stock undefined değilse göster */}
            {stock !== undefined && (
              <div className={clsx(
                "text-gray-500 flex items-center gap-1",
                size === "small" ? "mt-1 text-xs" : "mt-1 text-xs" // margin ve font boyutunu biraz artırdık
              )}>
                Stok: <span className={clsx(
                  stock === 0 ? "text-red-500 font-medium" : 
                  stock < 5 ? "text-orange-500 font-medium" : 
                  "text-gray-600"
                )}>{stock}</span>
                {stock < 5 && stock > 0 && <AlertTriangle size={size === "small" ? 10 : 12} className="text-orange-500" />}
                {stock === 0 && <span className="text-red-500 font-medium">Tükendi</span>}
              </div>
            )}
            
            {/* Fiyat Alanı */}
            <div className={clsx(
              "flex justify-between items-center",
              size === "small" ? "mt-1" : "mt-2" // margin'i koruduk
            )}>
              <div className={clsx(
                "font-bold text-primary-700",
                size === "small" ? "text-base" : "text-lg" // Font boyutunu text-sm'den text-base'e yükselttik
              )}>
                {price || "Fiyat belirtilmemiş"}
              </div>
            </div>
          </div>
        </button>
      </div>
    );
  }

  if (variant === "stat") {
    return (
      <div className={clsx(
        "bg-white rounded-xl p-6 border hover:border-gray-200 transition-colors h-full shadow-sm",
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
    "bg-white rounded-xl p-4 transition-all duration-200 h-full",
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