import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import Receipt from "../components/Receipt";

export default function SalesHistory() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [count, setCount] = useState(0);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({ date_from: "", date_to: "", branch: "" });
  const [viewing, setViewing] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    api.get(`/pos/sales/?${params}`).then((res) => {
      setSales(res.data.results);
      setCount(res.data.count);
    });
  }, [filters]);

  useEffect(load, [load]);
  useEffect(() => {
    if (user.role === "admin") {
      api.get("/tenants/branches/").then((res) => setBranches(res.data.results));
    }
  }, [user.role]);

  if (viewing) {
    return (
      <>
        <h2 className="page no-print">Receipt #{viewing.receipt?.receipt_number}</h2>
        <div className="card no-print" style={{ display: "flex", gap: ".8rem" }}>
          <button onClick={() => window.print()}>Print again</button>
          <button className="ghost" onClick={() => setViewing(null)}>Back to history</button>
        </div>
        <Receipt sale={viewing} />
      </>
    );
  }

  return (
    <>
      <h2 className="page">
        Sales history ({count})
        {user.role === "employee" && (
          <span style={{ fontSize: ".8rem", color: "#8a94a2", fontWeight: 400 }}> — your sales</span>
        )}
      </h2>
      <div className="card">
        <div className="row">
          <div className="field"><label>From</label>
            <input type="date" value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /></div>
          <div className="field"><label>To</label>
            <input type="date" value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /></div>
          {user.role === "admin" && (
            <div className="field"><label>Branch</label>
              <select value={filters.branch}
                onChange={(e) => setFilters({ ...filters, branch: e.target.value })}>
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
          )}
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>Receipt</th><th>Date</th><th>Branch</th><th>Seller</th><th>Items</th>
              <th style={{ textAlign: "right" }}>Total</th><th /></tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>#{sale.receipt?.receipt_number}</td>
                <td>{new Date(sale.created_at).toLocaleString()}</td>
                <td>{sale.branch_name}</td>
                <td>{sale.sold_by_name}</td>
                <td>{sale.items.length}</td>
                <td style={{ textAlign: "right" }}>{sale.total_amount}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="ghost small" onClick={() => setViewing(sale)}>View receipt</button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr><td colSpan={7} style={{ color: "#8a94a2" }}>No sales match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
