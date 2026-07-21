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

function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const isAdmin = user.role === "admin";
  const canInventory = can("can_manage_inventory");
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">Shop ERP</div>
        <NavLink to="/">Dashboard</NavLink>
        {can("can_use_pos") && <NavLink to="/pos">Point of sale</NavLink>}
        <NavLink to="/sales">Sales history</NavLink>
        <NavLink to="/stock">Stock</NavLink>
        {canInventory && (
          <>
            <NavLink to="/stock/intake">Stock intake</NavLink>
            <NavLink to="/products">Products &amp; SKUs</NavLink>
            <NavLink to="/categories">Categories</NavLink>
            <NavLink to="/brands">Brands</NavLink>
            <NavLink to="/suppliers">Suppliers</NavLink>
          </>
        )}
        {can("can_view_reports") && <NavLink to="/reports">Reports</NavLink>}
        {isAdmin && (
          <>
            <NavLink to="/branches">Branches</NavLink>
            <NavLink to="/employees">Employees</NavLink>
          </>
        )}
        <div className="spacer" />
        <div className="who">
          {user.full_name || user.email}
          <br />
          role: {user.role}
        </div>
        <button className="ghost" onClick={logout}>Log out</button>
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
