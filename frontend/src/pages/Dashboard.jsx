import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Boxes, DollarSign, PackagePlus, Percent, Plus, ShoppingCart, TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

function Kpi({ icon: Icon, tint, label, value }) {
  return (
    <div className="metric">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="label">{label}</div>
        <div
          style={{
            width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
            background: tint.bg, color: tint.fg, flexShrink: 0,
          }}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const showFinance = can("can_view_finance");
  const showPos = can("can_use_pos");
  const [shop, setShop] = useState("");
  const [period, setPeriod] = useState("today");
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [top, setTop] = useState([]);
  const [stock, setStock] = useState({ available: "—" });
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    api.get("/health/").then((res) => setShop(res.data.shop_name || ""));
    api.get("/inventory/stock-units/?is_sold=false")
      .then((res) => setStock({ available: res.data.count }))
      .catch(() => {});
    api.get("/inventory/products/?page_size=200")
      .then((res) => {
        const low = res.data.results.filter(
          (p) => p.minimum_stock != null && p.current_stock <= p.minimum_stock
        );
        setLowStock(low.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  const loadFinance = useCallback(() => {
    if (!showFinance) return;
    api.get(`/finance/summary/?period=${period}`).then((res) => setSummary(res.data));
    api.get(`/finance/sales-over-time/?period=${period}`).then((res) => setSeries(res.data));
    api.get(`/finance/top-products/?period=${period}`).then((res) => setTop(res.data));
  }, [period, showFinance]);

  useEffect(loadFinance, [loadFinance]);

  const maxRevenue = Math.max(...series.map((r) => Number(r.revenue)), 1);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem", flexWrap: "wrap", gap: ".8rem" }}>
        <div>
          <h2 className="page" style={{ marginBottom: ".2rem" }}>{shop || "Dashboard"}</h2>
          <p style={{ fontSize: ".85rem", color: "var(--text-secondary)" }}>
            Welcome back, {(user.full_name || user.email).split(" ")[0]} — here's how your shop is doing.
          </p>
        </div>
        {showFinance && (
          <div style={{ display: "flex", gap: ".4rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: ".25rem" }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                className={period === p.value ? "small" : "ghost small"}
                style={period !== p.value ? { border: "none" } : undefined}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showFinance ? (
        <>
          <div className="metrics">
            <Kpi icon={DollarSign} tint={{ bg: "var(--brand-50)", fg: "var(--brand-600)" }} label="Revenue" value={summary?.revenue ?? "—"} />
            <Kpi icon={Percent} tint={{ bg: "var(--warning-50)", fg: "var(--warning-600)" }} label="COGS" value={summary?.cogs ?? "—"} />
            <Kpi icon={TrendingUp} tint={{ bg: "var(--success-50)", fg: "var(--success-600)" }} label="Gross profit" value={summary?.gross_profit ?? "—"} />
            <Kpi icon={ShoppingCart} tint={{ bg: "var(--brand-50)", fg: "var(--brand-600)" }} label="Units sold" value={summary?.units_sold ?? "—"} />
            <Kpi icon={Boxes} tint={{ bg: "var(--slate-100)", fg: "var(--text-secondary)" }} label="Units in stock" value={stock.available} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem", alignItems: "start" }}>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".2rem" }}>
                <h3 style={{ marginBottom: 0 }}>Sales over time</h3>
                {summary && (
                  <span style={{ fontSize: ".78rem", color: "var(--text-tertiary)" }}>
                    {summary.start} → {summary.end}
                  </span>
                )}
              </div>
              {series.length === 0 ? (
                <div className="empty-state">
                  <div className="icon-wrap"><TrendingUp size={20} /></div>
                  <h4>No sales in this period yet</h4>
                  <p>Once you record sales through POS, you'll see the trend here.</p>
                  {showPos && <Link to="/pos"><button className="small">Go to POS</button></Link>}
                </div>
              ) : (
                <div className="chart">
                  {series.map((row) => (
                    <div key={row.day} className="chart-col" title={`${row.day}: ${row.revenue}`}>
                      <div className="chart-bar" style={{ height: `${(Number(row.revenue) / maxRevenue) * 130 + 4}px` }} />
                      <div className="chart-label">{row.day.slice(5)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: ".8rem" }}>
                <AlertTriangle size={16} color="var(--warning-600)" />
                <h3 style={{ marginBottom: 0 }}>Low stock alerts</h3>
              </div>
              {lowStock.length === 0 ? (
                <p style={{ fontSize: ".85rem", color: "var(--text-secondary)" }}>
                  All products are above their minimum stock threshold.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                  {lowStock.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".85rem" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }} title={p.name}>
                        {p.name}
                      </span>
                      <span className="badge red">{p.current_stock} / {p.minimum_stock} min</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Top-selling products</h3>
            {top.length === 0 ? (
              <div className="empty-state" style={{ padding: "1.4rem 1rem" }}>
                <p>No sales in this period.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Product</th><th>Units</th><th>Revenue</th><th>Profit</th></tr>
                  </thead>
                  <tbody>
                    {top.map((row) => (
                      <tr key={row.product}>
                        <td style={{ textAlign: "left" }}>{row.product}</td>
                        <td>{row.units}</td>
                        <td>{row.revenue}</td>
                        <td style={{ color: "var(--success-600)", fontWeight: 600 }}>{row.profit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="metrics">
            <Kpi icon={Boxes} tint={{ bg: "var(--brand-50)", fg: "var(--brand-600)" }} label="Units in stock" value={stock.available} />
          </div>
          <div className="card">
            <h3>Welcome, {user.full_name || user.email}</h3>
            <p style={{ fontSize: ".9rem", color: "var(--text-secondary)" }}>
              Financial figures are visible to accounts with the finance permission.
              Use the menu to access your permitted areas.
            </p>
          </div>
        </>
      )}

      <div className="card">
        <h3>Quick actions</h3>
        <div className="row">
          {showPos && (
            <Link to="/pos"><button><ShoppingCart size={15} /> New sale</button></Link>
          )}
          <Link to="/stock/intake"><button className="ghost"><PackagePlus size={15} /> Stock intake</button></Link>
          <Link to="/products-list"><button className="ghost"><Plus size={15} /> New product</button></Link>
        </div>
      </div>
    </>
  );
}
