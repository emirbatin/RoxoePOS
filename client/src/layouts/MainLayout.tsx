import React, { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Settings,
  Bell,
  History,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import NotificationPopup from "../components/NotificationPopup";

const TopNav = () => {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-white shadow-soft h-16 flex justify-between px-6 items-center">
      <h1 className="text-xl font-semibold text-gray-800">Roxoe POS</h1>
      <div className="flex-1 flex justify-center">
        <nav className="flex items-center gap-4">
          <button
            onClick={() => navigate("/pos")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <ShoppingCart size={20} />
            <span className="font-medium">Satış</span>
          </button>
          <button
            onClick={() => navigate("/products")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <Package size={20} />
            <span className="font-medium">Ürünler</span>
          </button>
          <button
            onClick={() => navigate("/credit")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <Users size={20} />
            <span className="font-medium">Veresiye</span>
          </button>
          <button
            onClick={() => navigate("/reports")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <FileText size={20} />
            <span className="font-medium">Raporlar</span>
          </button>
          <button
            onClick={() => navigate("/history")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <History size={20} />
            <span className="font-medium">Geçmiş</span>
          </button>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            className="p-2 hover:bg-gray-100 rounded-full relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} className="text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          <NotificationPopup
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block text-right">
            <div className="text-sm font-medium text-gray-900">Admin</div>
            <div className="text-xs text-gray-500">Yönetici</div>
          </div>
          <button
            onClick={() => navigate("/settings")}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <Settings size={20} className="text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
};

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <TopNav />
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
