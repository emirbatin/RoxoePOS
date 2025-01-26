import React, { ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "save";
  icon?: React.ElementType; // Burada türü React.ElementType olarak değiştirdik
  className?: string;
  type?: "button" | "submit" | "reset";
}

const Button: React.FC<ButtonProps> = ({
  onClick,
  disabled = false,
  children,
  variant = "primary",
  icon: Icon,
  className,
  type = "button",
  ...props
}) => {
  const baseClasses =
    "w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 focus:outline-none";

  const variants = {
    primary:
      "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed",
    secondary:
      "bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed",
    danger:
      "bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed",
    save:
      "bg-green-600 text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={clsx(baseClasses, variants[variant], className)}
      {...props}
    >
      {Icon && <Icon size={20} />}{" "}
      {/* Burada size propsunu kullanmaya devam ediyoruz */}
      {children}
    </button>
  );
};

export default Button;
