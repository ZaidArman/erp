import { useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
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

function NavGroup({ label, collapsed, children }) {
  return (
    <div className="nav-group">
      {!collapsed && <div className="nav-group-label">{label}</div>}
      {children}
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
          {!collapsed && <div className="brand">Shop ERP</div>}
          <button
            className="nav-toggle"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <NavLink to="/" end className="nav-link">
          <span className="nav-icon">⌂</span>
          {!collapsed && <span>Dashboard</span>}
        </NavLink>

        {canInventory && (
          <NavGroup label="Inventory" collapsed={collapsed}>
            <NavLink to="/stock" className="nav-link">
              <span className="nav-icon">▤</span>
              {!collapsed && <span>Stock</span>}
            </NavLink>
            <NavLink to="/products" className="nav-link">
              <span className="nav-icon">▤</span>
              {!collapsed && <span>Products &amp; SKUs</span>}
            </NavLink>
            <NavLink to="/categories" className="nav-link">
              <span className="nav-icon">▤</span>
              {!collapsed && <span>Categories</span>}
            </NavLink>
            <NavLink to="/brands" className="nav-link">
              <span className="nav-icon">▤</span>
              {!collapsed && <span>Brands</span>}
            </NavLink>
          </NavGroup>
        )}

        <NavGroup label="POS" collapsed={collapsed}>
          {can("can_use_pos") && (
            <NavLink to="/pos" className="nav-link">
              <span className="nav-icon">$</span>
              {!collapsed && <span>Point of sale</span>}
            </NavLink>
          )}
          <NavLink to="/sales" className="nav-link">
            <span className="nav-icon">≡</span>
            {!collapsed && <span>Sales history</span>}
          </NavLink>
        </NavGroup>

        {canInventory && (
          <NavGroup label="Supply management" collapsed={collapsed}>
            <NavLink to="/stock/intake" className="nav-link">
              <span className="nav-icon">↧</span>
              {!collapsed && <span>Stock intake</span>}
            </NavLink>
            <NavLink to="/suppliers" className="nav-link">
              <span className="nav-icon">⚑</span>
              {!collapsed && <span>Suppliers</span>}
            </NavLink>
          </NavGroup>
        )}

        {can("can_view_reports") && (
          <NavGroup label="Reports" collapsed={collapsed}>
            <NavLink to="/reports" className="nav-link">
              <span className="nav-icon">▦</span>
              {!collapsed && <span>Reports</span>}
            </NavLink>
          </NavGroup>
        )}

        {isAdmin && (
          <NavGroup label="User's management" collapsed={collapsed}>
            <NavLink to="/employees" className="nav-link">
              <span className="nav-icon">☺</span>
              {!collapsed && <span>Employees</span>}
            </NavLink>
            <NavLink to="/branches" className="nav-link">
              <span className="nav-icon">⌘</span>
              {!collapsed && <span>Branches</span>}
            </NavLink>
          </NavGroup>
        )}

        <div className="spacer" />
        {!collapsed && (
          <div className="who">
            {user.full_name || user.email}
            <br />
            role: {user.role}
          </div>
        )}
        <button className="ghost" onClick={logout}>
          {collapsed ? "⏻" : "Log out"}
        </button>
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
