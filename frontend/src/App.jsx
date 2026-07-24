import { useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  Boxes,
  Building2,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  Receipt,
  ShoppingCart,
  Tags,
  TableProperties,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { AuthProvider, useAuth } from "./AuthContext";
import Logo from "./components/Logo";
import TopBar from "./components/TopBar";
import Branches from "./pages/Branches";
import Brands from "./pages/Brands";
import Categories from "./pages/Categories";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Login from "./pages/Login";
import POS from "./pages/POS";
import ProductsReport from "./pages/ProductsReport";
import Reports from "./pages/Reports";
import SalesHistory from "./pages/SalesHistory";
import Suppliers from "./pages/Suppliers";
import StockIntake from "./pages/StockIntake";
import StockList from "./pages/StockList";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: "2rem" }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function initials(user) {
  const source = user.full_name || user.email || "?";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
}

function NavGroup({ title, collapsed, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="nav-group">
      <button className="nav-group-header" onClick={() => setOpen((v) => !v)}>
        {title}
        <ChevronRight size={12} className={`chevron ${open ? "open" : ""}`} />
      </button>
      <div className={`nav-group-body ${open || collapsed ? "open" : "closed"}`}>
        <div>{children}</div>
      </div>
    </div>
  );
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
          <Logo workspace={user.tenant_name} collapsed={collapsed} />
          <button
            className="collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <div className="nav-scroll">
          <NavLink to="/" end className="nav-link" title="Dashboard">
            <span className="nav-icon"><LayoutDashboard size={17} /></span><span className="nav-text">Dashboard</span>
          </NavLink>
          <NavLink to="/products-list" className="nav-link" title="Products">
            <span className="nav-icon"><TableProperties size={17} /></span><span className="nav-text">Products</span>
          </NavLink>

          {canInventory && (
            <NavGroup title="Inventory" collapsed={collapsed}>
              <NavLink to="/categories" className="nav-link" title="Categories">
                <span className="nav-icon"><Tags size={17} /></span><span className="nav-text">Categories</span>
              </NavLink>
              <NavLink to="/stock" className="nav-link" title="Stock">
                <span className="nav-icon"><Boxes size={17} /></span><span className="nav-text">Stock</span>
              </NavLink>
              <NavLink to="/stock/intake" className="nav-link" title="Stock intake">
                <span className="nav-icon"><PackageSearch size={17} /></span><span className="nav-text">Stock intake</span>
              </NavLink>
              <NavLink to="/suppliers" className="nav-link" title="Suppliers">
                <span className="nav-icon"><Truck size={17} /></span><span className="nav-text">Suppliers</span>
              </NavLink>
            </NavGroup>
          )}

          <NavGroup title="Sales" collapsed={collapsed}>
            {can("can_use_pos") && (
              <NavLink to="/pos" className="nav-link" title="Point of sale">
                <span className="nav-icon"><ShoppingCart size={17} /></span><span className="nav-text">Point of sale</span>
              </NavLink>
            )}
            <NavLink to="/sales" className="nav-link" title="Sales history">
              <span className="nav-icon"><Receipt size={17} /></span><span className="nav-text">Sales history</span>
            </NavLink>
          </NavGroup>

          {can("can_view_reports") && (
            <NavGroup title="Reports" collapsed={collapsed}>
              <NavLink to="/reports" className="nav-link" title="Reports">
                <span className="nav-icon"><TrendingUp size={17} /></span><span className="nav-text">Reports</span>
              </NavLink>
            </NavGroup>
          )}

          {isAdmin && (
            <NavGroup title="User management" collapsed={collapsed} defaultOpen={false}>
              <NavLink to="/employees" className="nav-link" title="Employees">
                <span className="nav-icon"><Users size={17} /></span><span className="nav-text">Employees</span>
              </NavLink>
              <NavLink to="/branches" className="nav-link" title="Branches">
                <span className="nav-icon"><Building2 size={17} /></span><span className="nav-text">Branches</span>
              </NavLink>
            </NavGroup>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="profile-card" title={user.full_name || user.email}>
            <span className="profile-avatar">{initials(user)}</span>
            <div className="profile-meta">
              <div className="profile-name">{user.full_name || user.email}</div>
              <div className="profile-role">{user.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} title="Log out">
            <LogOut size={15} /><span className="nav-text">Log out</span>
          </button>
        </div>
      </nav>
      <div className="app-main">
        <TopBar />
        <main className="main">{children}</main>
      </div>
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
                  <Route path="products-list" element={<ProductsReport />} />
                  <Route path="pos" element={<POS />} />
                  <Route path="sales" element={<SalesHistory />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="stock" element={<StockList />} />
                  <Route path="stock/intake" element={<StockIntake />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="brands" element={<Brands />} />
                  <Route path="suppliers" element={<Suppliers />} />
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
