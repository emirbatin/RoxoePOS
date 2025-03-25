// MainLayout.tsx - Ana Layout Bileşeni
import React, { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Settings,
  Bell,
  History,
  Calculator,
  Menu,
  ChevronLeft,
  BarChart3,
  TrendingUp,
  DollarSign,
  ChevronRight,
  X,
  ChevronDown,
  ClipboardList,
  Search,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import NotificationPopup from "../components/NotificationPopup";
import Icon from "../assets/icon.png"; 

// Sayfa başlıkları için arayüz
interface PageTitle {
  title: string;
  icon: React.ReactNode;
  description?: string;
}

// Tüm sayfa başlıklarını içeren nesne
const pageTitles: Record<string, PageTitle> = {
  "/pos": {
    title: "Satış Ekranı",
    icon: <ShoppingCart size={24} />,
    description: "Ürün satışı ve sepet yönetimi",
  },
  "/cash": {
    title: "Kasa İşlemleri",
    icon: <Calculator size={24} />,
    description: "Kasa hareketleri ve bakiye durumu",
  },
  "/products": {
    title: "Ürün Yönetimi",
    icon: <Package size={24} />,
    description: "Tüm ürünler ve stok durumu",
  },
  "/credit": {
    title: "Veresiye Defteri",
    icon: <Users size={24} />,
    description: "Müşteri borç ve ödemeleri",
  },
  "/history": {
    title: "İşlem Geçmişi",
    icon: <History size={24} />,
    description: "Tüm satış ve işlem kayıtları",
  },
  "/settings": {
    title: "Ayarlar",
    icon: <Settings size={24} />,
    description: "Sistem ve kullanıcı ayarları",
  },
  "/dashboard/overview": {
    title: "Genel Özet",
    icon: <TrendingUp size={24} />,
    description: "Satış ve kasa özeti",
  },
  "/dashboard/cash": {
    title: "Kasa Raporu",
    icon: <DollarSign size={24} />,
    description: "Kasa hareketleri ve bakiye analizi",
  },
  "/dashboard/sales": {
    title: "Satış Analizi",
    icon: <BarChart3 size={24} />,
    description: "Satış trendleri ve grafikler",
  },
  "/dashboard/products": {
    title: "Ürün Performansı",
    icon: <ClipboardList size={24} />,
    description: "Ürün bazlı satış ve karlılık",
  },
};

// TopNav Bileşeni
interface TopNavProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

// Dashboard alt navigasyon içeriğini tanımlayan arayüz
interface DashboardSubNav {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// Sidebar Bileşeni
interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

// Backdrop for Mobile
interface BackdropProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const TopNav = ({ toggleSidebar, isSidebarOpen }: TopNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  // Mevcut sayfanın başlığını belirle
  const getCurrentPageTitle = (): PageTitle => {
    // Tam URL path'ini al
    const path = location.pathname;

    // Dashboard alt sayfaları için özel durum
    if (path.startsWith("/dashboard/")) {
      const subPath = path.split("/").slice(0, 3).join("/");
      return (
        pageTitles[subPath] || {
          title: "Dashboard",
          icon: <FileText size={24} />,
          description: "Raporlar ve analizler",
        }
      );
    }

    // Ana sayfalar için
    return (
      pageTitles[path] || {
        title: "Roxoe",
        icon: <BarChart3 size={24} />,
        description: "Yönetim paneli",
      }
    );
  };

  const currentPage = getCurrentPageTitle();

  return (
    <header className="bg-white shadow-sm h-16 flex justify-between px-4 md:px-6 items-center sticky top-0 z-20">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="mr-4 text-gray-500 hover:text-gray-700 focus:outline-none md:hidden"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-800 flex items-center">
          <span className="text-indigo-600 mr-2">{currentPage.icon}</span>
          <div>
            <div>{currentPage.title}</div>
            {currentPage.description && (
              <div className="text-xs text-gray-500 font-normal hidden md:block">
                {currentPage.description}
              </div>
            )}
          </div>
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
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

const Sidebar = ({ isOpen, toggleSidebar }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);

  // Dashboard alt menü açık/kapalı durumu
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false);

  // Dashboard alt sekmeleri
  const dashboardSubNavs: DashboardSubNav[] = [
    {
      key: "overview",
      label: "Genel Özet",
      icon: <TrendingUp size={18} />,
      description: "Satış ve kasa özeti",
    },
    {
      key: "cash",
      label: "Kasa Raporu",
      icon: <DollarSign size={18} />,
      description: "Kasa hareketleri ve bakiye",
    },
    {
      key: "sales",
      label: "Satış Analizi",
      icon: <BarChart3 size={18} />,
      description: "Satış trendi ve grafikler",
    },
    {
      key: "products",
      label: "Ürün Performansı",
      icon: <ClipboardList size={18} />,
      description: "Ürün bazlı satış ve karlılık",
    },
  ];

  // URL'yi kontrol ederek dashboard alt sayfasında olup olmadığımızı belirleyelim
  const isDashboardPage = location.pathname.startsWith("/dashboard");
  const dashboardSubpage = isDashboardPage
    ? location.pathname.split("/")[2] || "overview"
    : "";

  // Mobil görünümde sidebar otomatik olarak daraltılmış olarak başlasın
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setExpanded(false);
      } else {
        setExpanded(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // URL değiştiğinde, eğer dashboard sayfasındaysak menüyü otomatik aç
  useEffect(() => {
    if (isDashboardPage) {
      setDashboardMenuOpen(true);
    }
  }, [location.pathname, isDashboardPage]);

  const navigationItems = [
    {
      path: "/pos",
      icon: <ShoppingCart size={20} />,
      label: "Satış",
      description: "POS ekranı ve hızlı satış",
    },
    {
      path: "/cash",
      icon: <Calculator size={20} />,
      label: "Kasa",
      description: "Kasa hareketleri ve bakiye",
    },
    {
      path: "/products",
      icon: <Package size={20} />,
      label: "Ürünler",
      description: "Stok ve ürün yönetimi",
    },
    {
      path: "/credit",
      icon: <Users size={20} />,
      label: "Veresiye",
      description: "Müşteri borç takibi",
    },
    {
      path: "/dashboard",
      icon: <FileText size={20} />,
      label: "Dashboard",
      description: "Raporlar ve analizler",
      hasSubmenu: true,
    },
    {
      path: "/history",
      icon: <History size={20} />,
      label: "Geçmiş",
      description: "İşlem geçmişi ve kayıtlar",
    },
  ];

  return (
    <div
      className={`fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 transition-all duration-300 transform 
        ${isOpen ? "translate-x-0" : "-translate-x-full"} 
        ${expanded ? "md:w-64" : "md:w-20"} 
        md:translate-x-0 md:relative`}
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
        <div
          className={`flex items-center ${
            expanded ? "" : "justify-center w-full"
          }`}
        >
          <div className="flex items-center justify-center h-10 w-10 bg-white text-white rounded-lg">
          <img src={Icon} alt="Logo" className="object-contain" />
          </div>
          {expanded && (
            <h1 className="font-bold text-lg ml-3 text-gray-800">Roxoe</h1>
          )}
        </div>

        <div className="flex items-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600 hidden md:block"
          >
            {expanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>

          <button
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-gray-600 ml-2 md:hidden"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="py-4 overflow-y-auto h-[calc(100vh-64px)]">
        <nav>
          {navigationItems.map((item) => {
            const isActive = item.hasSubmenu
              ? location.pathname.startsWith(item.path)
              : location.pathname === item.path;

            // Dashboard menüsü için özel durum
            const isDashboardItem = item.path === "/dashboard";

            return (
              <div key={item.path}>
                <button
                  onClick={() => {
                    if (isDashboardItem) {
                      // Dashboard menüsüne tıklandığında alt menüyü aç/kapat
                      setDashboardMenuOpen(!dashboardMenuOpen);
                      // İlk kez tıklandığında overview sayfasına yönlendir
                      if (!isDashboardPage) {
                        navigate(`${item.path}/overview`);
                      }
                    } else {
                      // Diğer bağlantılar için normal navigasyon
                      navigate(item.path);
                      if (window.innerWidth < 768) {
                        toggleSidebar();
                      }
                    }
                  }}
                  className={`w-full text-left ${
                    expanded
                      ? "px-4 py-3"
                      : "px-0 py-3 flex flex-col items-center justify-center"
                  } 
                    ${
                      isActive
                        ? "bg-indigo-50 text-indigo-600 border-r-4 border-indigo-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }
                    transition-colors`}
                >
                  <div
                    className={`flex items-center ${
                      expanded ? "" : "justify-center"
                    }`}
                  >
                    <span
                      className={`${
                        isActive ? "text-indigo-600" : "text-gray-500"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {expanded && (
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div
                            className={`text-sm font-medium ${
                              isActive ? "text-indigo-600" : ""
                            }`}
                          >
                            {item.label}
                          </div>
                          {isDashboardItem && (
                            <ChevronDown
                              size={16}
                              className={`transition-transform ${
                                dashboardMenuOpen ? "rotate-180" : ""
                              }`}
                            />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    )}
                  </div>
                </button>

                {/* Dashboard Alt Menüsü */}
                {isDashboardItem && dashboardMenuOpen && expanded && (
                  <div className="ml-4 pl-4 border-l border-gray-200 mb-2">
                    {dashboardSubNavs.map((subItem) => {
                      const isSubActive =
                        isDashboardPage && dashboardSubpage === subItem.key;
                      return (
                        <button
                          key={subItem.key}
                          onClick={() => {
                            navigate(`/dashboard/${subItem.key}`);
                            if (window.innerWidth < 768) {
                              toggleSidebar();
                            }
                          }}
                          className={`w-full text-left px-3 py-2 mb-1 rounded-md
                            ${
                              isSubActive
                                ? "bg-indigo-100 text-indigo-700"
                                : "text-gray-600 hover:bg-gray-50"
                            }
                            transition-colors`}
                        >
                          <div className="flex items-center">
                            <span
                              className={`${
                                isSubActive
                                  ? "text-indigo-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {subItem.icon}
                            </span>
                            <div className="ml-2">
                              <div
                                className={`text-sm font-medium ${
                                  isSubActive ? "text-indigo-700" : ""
                                }`}
                              >
                                {subItem.label}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

const Backdrop = ({ isOpen, toggleSidebar }: BackdropProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
      onClick={toggleSidebar}
    />
  );
};

// Ana Layout Bileşeni
const MainLayout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Sidebar dışına tıklandığında sidebar'ı kapat (mobil görünümde)
  useEffect(() => {
    const handleRouteChange = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleRouteChange);
    return () => window.removeEventListener("resize", handleRouteChange);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Backdrop - Mobil için arka plan karartma */}
      <Backdrop isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav toggleSidebar={toggleSidebar} isSidebarOpen={sidebarOpen} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
