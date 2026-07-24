import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes, Download, DollarSign, ShoppingCart, TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

function firstName(user) {
  if (user.full_name) return user.full_name.split(" ")[0];
  return (user.email || "").split("@")[0] || "there";
}

function MetricCard({ icon: Icon, tint, label, value, caption }) {
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
      {caption && <div style={{ fontSize: ".76rem", color: "var(--text-tertiary)", marginTop: ".3rem" }}>{caption}</div>}
    </div>
  );
}

function money(v) {
  const n = Number(v ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const showFinance = can("can_view_finance");
  const showPos = can("can_use_pos");
  const showReports = can("can_view_reports");
  const [shop, setShop] = useState("");
  const [period, setPeriod] = useState("month");
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [top, setTop] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [stock, setStock] = useState({ available: "—" });
  const [lowStock, setLowStock] = useState([]);
  const [exporting, setExporting] = useState(false);

  const today = new Date();
  const todayLabel = today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

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
    api.get("/pos/sales/?page_size=5").then((res) => setRecentSales(res.data.results)).catch(() => {});
  }, []);

  const loadFinance = useCallback(() => {
    if (!showFinance) return;
    api.get(`/finance/summary/?period=${period}`).then((res) => setSummary(res.data));
    api.get(`/finance/sales-over-time/?period=${period}`).then((res) => setSeries(res.data));
    api.get(`/finance/top-products/?period=${period}`).then((res) => setTop(res.data));
  }, [period, showFinance]);

  useEffect(loadFinance, [loadFinance]);

  const maxRevenue = Math.max(...series.map((r) => Number(r.revenue)), 1);
  const revenue = Number(summary?.revenue ?? 0);
  const cogs = Number(summary?.cogs ?? 0);
  const grossProfit = Number(summary?.gross_profit ?? 0);
  const cogsPct = revenue > 0 ? (cogs / revenue) * 100 : 0;

  // SVG area-chart geometry, derived straight from the sales-over-time series.
  const areaChart = useMemo(() => {
    if (series.length === 0) return null;
    const w = 560, h = 170, padX = 8, padY = 14;
    const values = series.map((r) => Number(r.revenue));
    const max = Math.max(...values, 1);
    const stepX = series.length > 1 ? (w - padX * 2) / (series.length - 1) : 0;
    const points = values.map((v, i) => ({
      x: padX + i * stepX,
      y: h - padY - (v / max) * (h - padY * 2),
      day: series[i].day,
      value: v,
    }));
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1].x},${h - padY} L${points[0].x},${h - padY} Z`;
    const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);
    return { w, h, linePath, areaPath, points, peak };
  }, [series]);

  const exportSalesCsv = () => {
    setExporting(true);
    api.get(`/finance/sales-report-csv/?period=${period}`, { responseType: "blob" })
      .then((res) => {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `sales-report-${period}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .finally(() => setExporting(false));
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem", flexWrap: "wrap", gap: ".9rem" }}>
        <div>
          <h2 className="page" style={{ marginBottom: ".2rem" }}>
            Welcome {firstName(user)}!
          </h2>
          <p style={{ fontSize: ".85rem", color: "var(--text-secondary)" }}>
            Today is {todayLabel}{shop ? ` — ${shop}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
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
          {showReports && (
            <button className="ghost small" onClick={exportSalesCsv} disabled={exporting}>
              <Download size={14} /> {exporting ? "Exporting…" : "Export"}
            </button>
          )}
        </div>
      </div>

      {showFinance ? (
        <>
          <div className="metrics">
            <MetricCard
              icon={DollarSign} tint={{ bg: "var(--brand-50)", fg: "var(--brand-600)" }}
              label="Revenue" value={summary ? money(summary.revenue) : "—"}
              caption={summary ? `${summary.start} → ${summary.end}` : undefined}
            />
            <MetricCard
              icon={TrendingUp} tint={{ bg: "var(--success-50)", fg: "var(--success-600)" }}
              label="Gross profit" value={summary ? money(summary.gross_profit) : "—"}
              caption={summary && revenue > 0 ? `${(100 - cogsPct).toFixed(1)}% margin` : undefined}
            />
            <MetricCard
              icon={ShoppingCart} tint={{ bg: "var(--warning-50)", fg: "var(--warning-600)" }}
              label="Units sold" value={summary?.units_sold ?? "—"}
              caption={summary ? `${summary.sales_count} sale(s)` : undefined}
            />
            <MetricCard
              icon={Boxes} tint={{ bg: "var(--slate-100)", fg: "var(--text-secondary)" }}
              label="Units in stock" value={stock.available}
              caption={lowStock.length > 0 ? `${lowStock.length} below minimum` : "All above minimum"}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1.3fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.25rem" }}>
            {/* Revenue breakdown donut */}
            <div className="card">
              <h3>Revenue breakdown</h3>
              {revenue === 0 ? (
                <div className="empty-state" style={{ padding: "1.2rem .5rem" }}>
                  <p>No revenue in this period yet.</p>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      width: 150, height: 150, borderRadius: "50%", margin: "0 auto 1.1rem",
                      background: `conic-gradient(var(--warning-500) 0% ${cogsPct}%, var(--success-500) ${cogsPct}% 100%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <div style={{
                      width: 104, height: 104, borderRadius: "50%", background: "var(--surface)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>{money(revenue)}</div>
                      <div style={{ fontSize: ".72rem", color: "var(--text-tertiary)" }}>Revenue</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: ".6rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: ".35rem", fontWeight: 700 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--warning-500)" }} />
                        {money(cogs)}
                      </div>
                      <div style={{ fontSize: ".76rem", color: "var(--text-tertiary)" }}>COGS</div>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: ".35rem", fontWeight: 700 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--success-500)" }} />
                        {money(grossProfit)}
                      </div>
                      <div style={{ fontSize: ".76rem", color: "var(--text-tertiary)" }}>Profit</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sales over time bar chart */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ marginBottom: 0 }}>Sales over time</h3>
                <span style={{ display: "flex", alignItems: "center", gap: ".3rem", fontSize: ".75rem", color: "var(--text-tertiary)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--brand-500)" }} /> Revenue
                </span>
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

            {/* Total income area chart */}
            <div className="card">
              <h3 style={{ marginBottom: ".1rem" }}>Total income</h3>
              <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{money(revenue)}</div>
              {areaChart ? (
                <div style={{ position: "relative", marginTop: ".6rem" }}>
                  <svg viewBox={`0 0 ${areaChart.w} ${areaChart.h}`} style={{ width: "100%", height: "170px", overflow: "visible" }}>
                    <defs>
                      <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaChart.areaPath} fill="url(#income-fill)" />
                    <path d={areaChart.linePath} fill="none" stroke="var(--brand-500)" strokeWidth="2.5" />
                    <circle cx={areaChart.peak.x} cy={areaChart.peak.y} r="4" fill="var(--brand-600)" stroke="#fff" strokeWidth="2" />
                  </svg>
                  <div
                    style={{
                      position: "absolute", left: `${(areaChart.peak.x / areaChart.w) * 100}%`,
                      top: `${(areaChart.peak.y / areaChart.h) * 100}%`, transform: "translate(-50%, -135%)",
                      background: "var(--brand-600)", color: "#fff", borderRadius: "var(--radius-md)",
                      padding: ".3rem .6rem", fontSize: ".76rem", fontWeight: 700, whiteSpace: "nowrap",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {money(areaChart.peak.value)} <span style={{ opacity: .8, fontWeight: 500 }}>· {areaChart.peak.day.slice(5)}</span>
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "1.2rem .5rem" }}>
                  <p>No sales in this period.</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}>
            <div className="card">
              <h3>Recent sales</h3>
              {recentSales.length === 0 ? (
                <div className="empty-state" style={{ padding: "1.2rem .5rem" }}>
                  <p>No sales recorded yet.</p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>S/N</th><th>Receipt</th><th>Customer</th><th>Date</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {recentSales.map((s, i) => (
                        <tr key={s.id}>
                          <td>{String(i + 1).padStart(2, "0")}</td>
                          <td>{s.receipt?.receipt_number ?? "—"}</td>
                          <td style={{ textAlign: "left" }}>{s.customer_name || "Walk-in"}</td>
                          <td>{new Date(s.created_at).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${s.payment_method === "credit" ? (Number(s.balance_due) > 0 ? "red" : "green") : "green"}`}>
                              {s.payment_method === "credit" ? (Number(s.balance_due) > 0 ? "outstanding" : "settled") : "paid"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h3>Top-selling products</h3>
              {top.length === 0 ? (
                <div className="empty-state" style={{ padding: "1.2rem .5rem" }}>
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
          </div>
        </>
      ) : (
        <>
          <div className="metrics">
            <MetricCard icon={Boxes} tint={{ bg: "var(--brand-50)", fg: "var(--brand-600)" }} label="Units in stock" value={stock.available} />
          </div>
          <div className="card">
            <h3>Welcome, {firstName(user)}</h3>
            <p style={{ fontSize: ".9rem", color: "var(--text-secondary)" }}>
              Financial figures are visible to accounts with the finance permission.
              Use the menu to access your permitted areas.
            </p>
          </div>
        </>
      )}
    </>
  );
}
