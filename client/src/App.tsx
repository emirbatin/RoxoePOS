// src/App.tsx
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";
import MainLayout from "./layouts/MainLayout";
import POSPage from "./pages/POSPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import SaleDetailPage from "./pages/SaleDetailPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import CreditPage from "./pages/CreditPage";
import SettingsPage from "./pages/SettingsPage";
import AlertProvider from "./components/AlertProvider";
import { NotificationProvider } from "./contexts/NotificationContext";
import LicenseActivation from "./components/LicenseActivation";
import UpdateNotification from "./components/UpdateNotification";
import KasaYonetimi from "./pages/CashRegisterPage";
import DynamicWindowTitle from "./components/DynamicWindowTitle"; // İMPORT EDİLDİ

function App() {
  const [isLicensed, setIsLicensed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = async () => {
    try {
      const result = await window.ipcRenderer.invoke("check-license");
      setIsLicensed(result.isValid);
    } catch (error) {
      console.error("License check failed:", error);
      setIsLicensed(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-600">Lisans kontrol ediliyor...</div>
      </div>
    );
  }

  return (
    <>
      <Router>
        <NotificationProvider>
          {!isLicensed ? (
            <AlertProvider>
              <div className="h-screen">
                <LicenseActivation onSuccess={() => setIsLicensed(true)} />
              </div>
            </AlertProvider>
          ) : (
            <MainLayout>
              <AlertProvider>
                <Routes>
                  <Route path="/" element={<POSPage />} />
                  <Route path="/pos" element={<POSPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/credit" element={<CreditPage />} />
                  <Route path="/history" element={<SalesHistoryPage />} />
                  <Route path="/cash" element={<KasaYonetimi />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/sales/:id" element={<SaleDetailPage />} />
                  {/* Dashboard ana rotası - overview'a yönlendir */}
                  <Route
                    path="/dashboard"
                    element={<Navigate to="/dashboard/overview" replace />}
                  />

                  {/* Dashboard alt rotaları */}
                  <Route
                    path="/dashboard/:tabKey"
                    element={<DashboardPage />}
                  />
                </Routes>
              </AlertProvider>
            </MainLayout>
          )}
        </NotificationProvider>
      </Router>
      <UpdateNotification />
      <DynamicWindowTitle /> {/* EKLENDİ - Animasyonlu pencere başlığı */}
    </>
  );
}

export default App;