import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Dashboard() {
  const { user, can } = useAuth();
  const showFinance = can("can_view_finance");
  const [shop, setShop] = useState("");
  const [period, setPeriod] = useState("today");
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [top, setTop] = useState([]);
  const [stock, setStock] = useState({ available: "—" });

  useEffect(() => {
    api.get("/health/").then((res) => setShop(res.data.shop_name || ""));
    api.get("/inventory/stock-units/?is_sold=false")
      .then((res) => setStock({ available: res.data.count }))
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
      <h2 className="page">{shop || "Dashboard"}</h2>

      {showFinance ? (
        <>
          <div className="card" style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <span style={{ fontSize: ".85rem", color: "#5c6673" }}>Period:</span>
            {["today", "week", "month"].map((p) => (
              <button
                key={p}
                className={period === p ? "small" : "ghost small"}
                onClick={() => setPeriod(p)}
              >
                {p === "today" ? "Today" : p === "week" ? "This week" : "This month"}
              </button>
            ))}
            {summary && (
              <span style={{ marginLeft: "auto", fontSize: ".8rem", color: "#8a94a2" }}>
                {summary.start} → {summary.end}
              </span>
            )}
          </div>

          <div className="metrics">
            <div className="metric">
              <div className="label">Revenue</div>
              <div className="value">{summary?.revenue ?? "—"}</div>
            </div>
            <div className="metric">
              <div className="label">COGS</div>
              <div className="value">{summary?.cogs ?? "—"}</div>
            </div>
            <div className="metric">
              <div className="label">Gross profit</div>
              <div className="value" style={{ color: "#1d7a46" }}>
                {summary?.gross_profit ?? "—"}
              </div>
            </div>
            <div className="metric">
              <div className="label">Units sold</div>
              <div className="value">{summary?.units_sold ?? "—"}</div>
            </div>
            <div className="metric">
              <div className="label">Units in stock</div>
              <div className="value">{stock.available}</div>
            </div>
          </div>

          <div className="card">
            <h3>Sales over time</h3>
            {series.length === 0 ? (
              <p style={{ color: "#8a94a2", fontSize: ".9rem" }}>No sales in this period yet.</p>
            ) : (
              <div className="chart">
                {series.map((row) => (
                  <div key={row.day} className="chart-col" title={`${row.day}: ${row.revenue}`}>
                    <div
                      className="chart-bar"
                      style={{ height: `${(Number(row.revenue) / maxRevenue) * 130 + 4}px` }}
                    />
                    <div className="chart-label">{row.day.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Top-selling products</h3>
            <table>
              <thead>
                <tr><th>Product</th><th>Units</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                  <th style={{ textAlign: "right" }}>Profit</th></tr>
              </thead>
              <tbody>
                {top.map((row) => (
                  <tr key={row.product}>
                    <td>{row.product}</td>
                    <td>{row.units}</td>
                    <td style={{ textAlign: "right" }}>{row.revenue}</td>
                    <td style={{ textAlign: "right", color: "#1d7a46" }}>{row.profit}</td>
                  </tr>
                ))}
                {top.length === 0 && (
                  <tr><td colSpan={4} style={{ color: "#8a94a2" }}>No sales in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="metrics">
            <div className="metric">
              <div className="label">Units in stock</div>
              <div className="value">{stock.available}</div>
            </div>
          </div>
          <div className="card">
            <h3>Welcome, {user.full_name || user.email}</h3>
            <p style={{ fontSize: ".9rem", color: "#5c6673" }}>
              Financial figures are visible to accounts with the finance permission.
              Use the menu to access your permitted areas.
            </p>
          </div>
        </>
      )}
    </>
  );
}
