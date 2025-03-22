import React, { ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  disabled?: boolean;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "save" | "outline" ;
  icon?: React.ElementType;
  className?: string;
  type?: "button" | "submit" | "reset";
  title?: string;
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  onClick = () => {},
  disabled = false,
  children,
  variant = "primary",
  icon: Icon,
  className,
  type = "button",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "w-full rounded-lg font-semibold flex items-center justify-center gap-2 focus:outline-none transition-colors duration-200";

  const sizeClasses = {
    sm: "py-2 px-3 text-sm",
    md: "py-3 px-4 text-base",
    lg: "py-4 px-5 text-lg",
  };

  const variants = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed",
    secondary:
      "bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed",
    danger:
      "bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed",
    save:
      "bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed",
    outline:
      "border border-gray-400 text-gray-700 hover:bg-gray-100 disabled:bg-gray-100 disabled:cursor-not-allowed",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={clsx(baseClasses, sizeClasses[size], variants[variant], className)}
      {...props}
    >
      {Icon && <Icon size={20} className="text-current" />}
      {children}
    </button>
  );
};

export default Button;