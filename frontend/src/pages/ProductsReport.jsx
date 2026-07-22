import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";

const COLUMNS = [
  { key: "product_id", label: "Product ID" },
  { key: "product_name", label: "Product" },
  { key: "category_name", label: "Category" },
  { key: "brand_name", label: "Brand" },
  { key: "imei_serial", label: "Serial number" },
  { key: "sell_price", label: "Sell price" },
  { key: "purchase_cost", label: "Purchase" },
  { key: "created_at", label: "Created date" },
  { key: "updated_at", label: "Updated date" },
  { key: "created_by_name", label: "Created by" },
  { key: "updated_by_name", label: "Updated by" },
];

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function ProductsReport() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});

  const load = useCallback(() => {
    api.get("/inventory/product-report/").then((res) => {
      setRows(res.data.results);
      setCount(res.data.count);
    });
  }, []);

  useEffect(load, [load]);

  const displayRows = useMemo(() => {
    return rows.map((r) => ({
      id: r.id,
      product_id: r.product_id ?? "",
      product_name: r.product_name || "",
      category_name: r.category_name || "",
      brand_name: r.brand_name || "",
      imei_serial: r.imei_serial || "",
      sell_price: r.sell_price ?? "",
      purchase_cost: r.purchase_cost ?? "",
      created_at: formatDate(r.created_at),
      updated_at: formatDate(r.updated_at),
      created_by_name: r.created_by_name || "",
      updated_by_name: r.updated_by_name || "",
    }));
  }, [rows]);

  const setColFilter = (key, value) => setColFilters((f) => ({ ...f, [key]: value }));

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayRows.filter((row) => {
      if (q) {
        const hit = COLUMNS.some((c) => String(row[c.key]).toLowerCase().includes(q));
        if (!hit) return false;
      }
      return COLUMNS.every((c) => {
        const val = colFilters[c.key];
        if (!val) return true;
        return String(row[c.key]).toLowerCase().includes(val.trim().toLowerCase());
      });
    });
  }, [displayRows, search, colFilters]);

  const exportCsv = () => {
    const header = COLUMNS.map((c) => c.label).join(",");
    const body = filteredRows
      .map((row) => COLUMNS.map((c) => csvEscape(row[c.key])).join(","))
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h2 className="page">Products ({count})</h2>
      <div className="card">
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Global search</label>
            <input
              value={search}
              placeholder="Search across all columns…"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field" style={{ alignSelf: "end", flex: 0 }}>
            <button className="ghost" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
              </tr>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} style={{ paddingTop: 0, paddingBottom: ".5rem" }}>
                    <input
                      className="small"
                      style={{ fontSize: ".78rem", padding: ".3rem .4rem" }}
                      value={colFilters[c.key] || ""}
                      placeholder="Filter…"
                      onChange={(e) => setColFilter(c.key, e.target.value)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.product_id}</td>
                  <td>{r.product_name}</td>
                  <td>{r.category_name}</td>
                  <td>{r.brand_name}</td>
                  <td style={{ fontFamily: "monospace" }}>{r.imei_serial}</td>
                  <td>{r.sell_price}</td>
                  <td>{r.purchase_cost}</td>
                  <td style={{ fontSize: ".8rem", color: "#5c6673" }}>{r.created_at}</td>
                  <td style={{ fontSize: ".8rem", color: "#5c6673" }}>{r.updated_at}</td>
                  <td>{r.created_by_name}</td>
                  <td>{r.updated_by_name}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={COLUMNS.length} style={{ color: "#8a94a2" }}>No products match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
