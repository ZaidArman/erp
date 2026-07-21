import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ available: "—", sold: "—", products: "—" });
  const [shop, setShop] = useState("");

  useEffect(() => {
    api.get("/health/").then((res) => setShop(res.data.shop_name || ""));
    api.get("/inventory/stock-units/?is_sold=false").then((res) =>
      setStats((s) => ({ ...s, available: res.data.count }))
    ).catch(() => {});
    api.get("/inventory/stock-units/?is_sold=true").then((res) =>
      setStats((s) => ({ ...s, sold: res.data.count }))
    ).catch(() => {});
    api.get("/inventory/products/").then((res) =>
      setStats((s) => ({ ...s, products: res.data.count }))
    ).catch(() => setStats((s) => ({ ...s, products: "n/a" })));
  }, []);

  return (
    <>
      <h2 className="page">{shop || "Dashboard"}</h2>
      <div className="metrics">
        <div className="metric"><div className="label">Units in stock</div><div className="value">{stats.available}</div></div>
        <div className="metric"><div className="label">Units sold</div><div className="value">{stats.sold}</div></div>
        <div className="metric"><div className="label">Products</div><div className="value">{stats.products}</div></div>
      </div>
      <div className="card">
        <h3>Welcome, {user.full_name || user.email}</h3>
        <p style={{ fontSize: ".9rem", color: "#5c6673" }}>
          This is the Phase 0–2 MVP: tenant workspace, accounts &amp; permissions, and the full
          inventory module. POS and finance arrive in Phases 3–4.
        </p>
      </div>
    </>
  );
}
