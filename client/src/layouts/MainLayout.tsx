import React, { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Settings,
  Bell,
  Menu,
  X,
  History,
  Server,
  ServerOff,
  Wifi,
  WifiOff,
} from "lucide-react";

// Header Component
const Header = ({ toggleSidebar }: { toggleSidebar: () => void }) => {
  return (
    <header className="bg-white shadow-soft h-16 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-full"
        >
          <Menu size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">Roxoe POS</h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-gray-100 rounded-full relative">
          <Bell size={20} className="text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-3">
          <div className="hidden md:block text-right">
            <div className="text-sm font-medium text-gray-900">Admin</div>
            <div className="text-xs text-gray-500">Yönetici</div>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Settings size={20} className="text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
};

// Sidebar Component
const Sidebar = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const serverStatus = false;

  const menuItems = [
    { icon: <Home size={20} />, label: "Ana Sayfa", path: "/" },
    { icon: <ShoppingCart size={20} />, label: "Satış", path: "/pos" },
    { icon: <Package size={20} />, label: "Ürünler", path: "/products" },
    { icon: <Users size={20} />, label: "Veresiye", path: "/credit" },
    { icon: <FileText size={20} />, label: "Raporlar", path: "/reports" },
    { icon: <History size={20} />, label: "Satış Geçmişi", path: "/history" },
  ];

  const isActivePath = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      <aside
        className={`
        fixed lg:static inset-y-0 left-0 z-30
        transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0
        transition duration-200 ease-in-out
        bg-white border-r w-64 flex flex-col
      `}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b lg:border-none">
          <span className="text-lg font-semibold text-primary-600">ROXOE</span>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto">
          <nav className="flex-1 px-4 pt-4">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  navigate(item.path);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center px-4 py-3 mb-2 rounded-lg
                  transition-colors duration-150 ease-in-out
                  ${
                    isActivePath(item.path)
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                {item.icon}
                <span className="mx-3 font-medium">{item.label}</span>
                {isActivePath(item.path) && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                )}
              </button>
            ))}
          </nav>

          {/* Bağlantı Durumu */}
          <div className="flex flex-col items-start justify-between px-6 py-4 border-t">
            {/* İnternet Durumu */}
            <div className="flex items-center gap-2 py-2">
              {navigator.onLine ? (
                <>
                  <Wifi className="text-green-500" size={20} />
                  <span className="text-sm font-medium text-gray-600">
                    İnternete Bağlı
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="text-red-500" size={20} />
                  <span className="text-sm font-medium text-gray-600">
                    İnternet Bağlantısı Yok
                  </span>
                </>
              )}
            </div>

            {/* Sunucu Durumu */}
            <div className="flex items-center gap-2 py-2">
              {serverStatus ? (
                <>
                  <Server className="text-green-500" size={20} />
                  <span className="text-sm font-medium text-gray-600">
                    Sunucuya Bağlı
                  </span>
                </>
              ) : (
                <>
                  <ServerOff className="text-red-500" size={20} />
                  <span className="text-sm font-medium text-gray-600">
                    Sunucu Bağlantısı Yok
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

// MainLayout Component
interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
