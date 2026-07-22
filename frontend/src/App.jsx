import { useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  Bookmark,
  Boxes,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  Receipt,
  ShoppingCart,
  Tag,
  Tags,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { AuthProvider, useAuth } from "./AuthContext";
import Branches from "./pages/Branches";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Login from "./pages/Login";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import SalesHistory from "./pages/SalesHistory";
import SimpleCrud from "./pages/SimpleCrud";
import StockIntake from "./pages/StockIntake";
import StockList from "./pages/StockList";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: "2rem" }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user.role === "admin";
  const canInventory = can("can_manage_inventory");
  return (
    <div className="layout">
      <nav className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="sidebar-top">
          <button
            className="collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
          {!collapsed && (
            <div className="brand" title={user.tenant_name || "Shop ERP"}>
              {user.tenant_name || "Shop ERP"}
            </div>
          )}
        </div>

        <div className="nav-scroll">
          <NavLink to="/" end className="nav-link" title="Dashboard">
            <span className="nav-icon"><LayoutDashboard size={18} /></span><span className="nav-text">Dashboard</span>
          </NavLink>

          {canInventory && (
            <div className="nav-group">
              <div className="nav-group-title">Inventory</div>
              <NavLink to="/stock" className="nav-link" title="Stock">
                <span className="nav-icon"><Boxes size={18} /></span><span className="nav-text">Stock</span>
              </NavLink>
              <NavLink to="/stock/intake" className="nav-link" title="Stock intake">
                <span className="nav-icon"><PackageSearch size={18} /></span><span className="nav-text">Stock intake</span>
              </NavLink>
              <NavLink to="/products" className="nav-link" title="Products & SKUs">
                <span className="nav-icon"><Tag size={18} /></span><span className="nav-text">Products &amp; SKUs</span>
              </NavLink>
              <NavLink to="/categories" className="nav-link" title="Categories">
                <span className="nav-icon"><Tags size={18} /></span><span className="nav-text">Categories</span>
              </NavLink>
              <NavLink to="/brands" className="nav-link" title="Brands">
                <span className="nav-icon"><Bookmark size={18} /></span><span className="nav-text">Brands</span>
              </NavLink>
              <NavLink to="/suppliers" className="nav-link" title="Suppliers">
                <span className="nav-icon"><Truck size={18} /></span><span className="nav-text">Suppliers</span>
              </NavLink>
            </div>
          )}

          <div className="nav-group">
            <div className="nav-group-title">Sales</div>
            {can("can_use_pos") && (
              <NavLink to="/pos" className="nav-link" title="Point of sale">
                <span className="nav-icon"><ShoppingCart size={18} /></span><span className="nav-text">Point of sale</span>
              </NavLink>
            )}
            <NavLink to="/sales" className="nav-link" title="Sales history">
              <span className="nav-icon"><Receipt size={18} /></span><span className="nav-text">Sales history</span>
            </NavLink>
          </div>

          {can("can_view_reports") && (
            <div className="nav-group">
              <div className="nav-group-title">Reports</div>
              <NavLink to="/reports" className="nav-link" title="Reports">
                <span className="nav-icon"><TrendingUp size={18} /></span><span className="nav-text">Reports</span>
              </NavLink>
            </div>
          )}

          {isAdmin && (
            <div className="nav-group">
              <div className="nav-group-title">User management</div>
              <NavLink to="/employees" className="nav-link" title="Employees">
                <span className="nav-icon"><Users size={18} /></span><span className="nav-text">Employees</span>
              </NavLink>
              <NavLink to="/branches" className="nav-link" title="Branches">
                <span className="nav-icon"><Building2 size={18} /></span><span className="nav-text">Branches</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="who">
              {user.full_name || user.email}
              <br />
              role: {user.role}
            </div>
          )}
          <button className="ghost" onClick={logout} title="Log out">
            <span className="nav-icon"><LogOut size={18} /></span><span className="nav-text">Log out</span>
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <Protected>
              <Layout>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="pos" element={<POS />} />
                  <Route path="sales" element={<SalesHistory />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="stock" element={<StockList />} />
                  <Route path="stock/intake" element={<StockIntake />} />
                  <Route path="products" element={<Products />} />
                  <Route
                    path="categories"
                    element={<SimpleCrud title="Categories" endpoint="/inventory/categories/" />}
                  />
                  <Route
                    path="brands"
                    element={<SimpleCrud title="Brands" endpoint="/inventory/brands/" />}
                  />
                  <Route
                    path="suppliers"
                    element={
                      <SimpleCrud
                        title="Suppliers"
                        endpoint="/inventory/suppliers/"
                        extraField="contact"
                      />
                    }
                  />
                  <Route path="branches" element={<Branches />} />
                  <Route path="employees" element={<Employees />} />
                </Routes>
              </Layout>
            </Protected>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
