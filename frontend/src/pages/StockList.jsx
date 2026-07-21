import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

export default function StockList() {
  const [units, setUnits] = useState([]);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState({ condition: "", is_sold: "false", imei: "" });

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.condition) params.set("condition", filters.condition);
    if (filters.is_sold) params.set("is_sold", filters.is_sold);
    if (filters.imei) params.set("imei", filters.imei.trim());
    api.get(`/inventory/stock-units/?${params}`).then((res) => {
      setUnits(res.data.results);
      setCount(res.data.count);
    });
  }, [filters]);

  useEffect(load, [load]);

  return (
    <>
      <h2 className="page">Stock ({count})</h2>
      <div className="card">
        <div className="row">
          <div className="field"><label>IMEI search (exact)</label>
            <input value={filters.imei} placeholder="358743110912345"
              onChange={(e) => setFilters({ ...filters, imei: e.target.value })} /></div>
          <div className="field"><label>Condition</label>
            <select value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value })}>
              <option value="">All</option>
              <option value="new">New</option>
              <option value="open_box">Open box</option>
              <option value="refurbished">Refurbished</option>
              <option value="used">Used</option>
            </select></div>
          <div className="field"><label>Status</label>
            <select value={filters.is_sold} onChange={(e) => setFilters({ ...filters, is_sold: e.target.value })}>
              <option value="">All</option>
              <option value="false">In stock</option>
              <option value="true">Sold</option>
            </select></div>
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>IMEI / serial</th><th>SKU</th><th>Branch</th><th>Condition</th><th>Purchase cost</th><th>Status</th></tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td style={{ fontFamily: "monospace" }}>{u.imei_serial}</td>
                <td>{u.sku_label}</td>
                <td>{u.branch_name}</td>
                <td><span className="badge gray">{u.condition}</span></td>
                <td>{u.purchase_cost}</td>
                <td><span className={`badge ${u.is_sold ? "red" : "green"}`}>{u.is_sold ? "sold" : "in stock"}</span></td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr><td colSpan={6} style={{ color: "#8a94a2" }}>No units match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
