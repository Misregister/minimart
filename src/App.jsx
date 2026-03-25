import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { ProductProvider } from './contexts/ProductContext';
import { CartProvider } from './contexts/CartContext';
import { ShiftProvider } from './contexts/ShiftContext';
import { CustomerProvider } from './contexts/CustomerContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { OrderProvider } from './contexts/OrderContext';
import { StoreCartProvider } from './contexts/StoreCartContext';

// Layouts
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AdminProviders from './components/layout/AdminProviders';

// Pages
// Pages (Lazy Loaded)
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const POS = React.lazy(() => import('./pages/POS'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Customers = React.lazy(() => import('./pages/Customers'));

// Direct import for reliability
import CustomerDisplay from './pages/CustomerDisplay';
const Insights = React.lazy(() => import('./pages/Insights'));
const ShiftHistory = React.lazy(() => import('./pages/ShiftHistory'));
const Settings = React.lazy(() => import('./pages/Settings'));
const OrderManager = React.lazy(() => import('./pages/OrderManager'));
const Storefront = React.lazy(() => import('./pages/Storefront'));
const StoreCheckout = React.lazy(() => import('./components/store/StoreCheckout'));
const OrderTracking = React.lazy(() => import('./components/store/OrderTracking'));
const PriceLabelPrinting = React.lazy(() => import('./pages/PriceLabelPrinting'));

// Loading Component
const PageLoader = () => (
  <div style={{
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
    color: '#6b7280',
    fontSize: '1.2rem',
    fontWeight: '500'
  }}>
    กำลังโหลด...
  </div>
);

// Global Error Boundary
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Global App Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '2rem',
          textAlign: 'center',
          color: '#1e293b'
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️ เกิดข้อผิดพลาดในระบบ</h1>
          <p style={{ color: '#64748b', marginBottom: '2rem', maxWidth: '600px' }}>
            ขออภัยในความไม่สะดวก ระบบพบปัญหาในการโหลดข้อมูล หากกด "Reload Page" แล้วไม่หาย
            กรุณากดปุ่ม <strong>"ล้างข้อมูลทั้งหมด"</strong> ด้านล่าง
          </p>

          <pre style={{
            color: '#ef4444',
            textAlign: 'left',
            background: '#fee2e2',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto',
            maxWidth: '800px',
            width: '100%',
            marginBottom: '2rem',
            fontSize: '0.85rem'
          }}>
            {this.state.error?.toString()}
          </pre>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600
              }}
            >
              🔄 ลองโหลดใหม่ (Reload)
            </button>

            <button
              onClick={() => {
                if (window.confirm("ยืนยันการล้างข้อมูลทั้งหมด? ข้อมูลในเครื่องจะหายไป (แต่ข้อมูลใน Server ยังอยู่)")) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#ef4444',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600
              }}
            >
              🗑️ ล้างข้อมูลแก้ Error (Factory Reset)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrapper that provides data contexts only after authentication
const AuthenticatedDataProviders = ({ children }) => (
  <ShiftProvider>
    <ProductProvider>
      <CartProvider>
        <CustomerProvider>
          <OrderProvider>
            {children}
          </OrderProvider>
        </CustomerProvider>
      </CartProvider>
    </ProductProvider>
  </ShiftProvider>
);

function App() {
  return (
    <LanguageProvider>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <GlobalErrorBoundary>
              <React.Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Auth Routes - No data providers needed */}
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<Login />} />
                  </Route>

                  {/* Store Routes - Use own lightweight data loading */}
                  <Route path="/store" element={
                    <ProductProvider>
                      <StoreCartProvider>
                        <OrderProvider>
                          <Storefront />
                        </OrderProvider>
                      </StoreCartProvider>
                    </ProductProvider>
                  } />
                  <Route path="/store/checkout" element={
                    <ProductProvider>
                      <StoreCartProvider>
                        <OrderProvider>
                          <StoreCheckout />
                        </OrderProvider>
                      </StoreCartProvider>
                    </ProductProvider>
                  } />
                  <Route path="/store/tracking/:orderId" element={
                    <ProductProvider>
                      <OrderProvider>
                        <OrderTracking />
                      </OrderProvider>
                    </ProductProvider>
                  } />

                  {/* Standalone Pages */}
                  <Route path="/customer-display" element={<CustomerDisplay />} />

                  {/* Protected Application Routes - Full data providers */}
                  <Route element={
                    <ProtectedRoute>
                      <AuthenticatedDataProviders>
                        <MainLayout />
                      </AuthenticatedDataProviders>
                    </ProtectedRoute>
                  }>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/pos" element={<POS />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/print-labels" element={<PriceLabelPrinting />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/shift-history" element={<ShiftHistory />} />
                    <Route path="/orders" element={<OrderManager />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  {/* Default Redirect */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </React.Suspense>
            </GlobalErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </SettingsProvider>
    </LanguageProvider>
  );
}

export default App;
