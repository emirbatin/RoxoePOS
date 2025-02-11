import { HashRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import POSPage from "./pages/POSPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import SaleDetailPage from "./pages/SaleDetailPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import CreditPage from "./pages/CreditPage";
import SettingsPage from "./pages/SettingsPage";
import AlertProvider from "./components/AlertProvider";

function App() {
  return (
    <AlertProvider>
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/" element={<POSPage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/credit" element={<CreditPage />} />
            <Route path="/history" element={<SalesHistoryPage />} />
            <Route path="/reports" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/sales/:id" element={<SaleDetailPage />} />
          </Routes>
        </MainLayout>
      </Router>
    </AlertProvider>
  );
}

export default App;
