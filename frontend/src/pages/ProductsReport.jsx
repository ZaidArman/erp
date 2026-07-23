import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Brands from "./Brands";

const PAGE_SIZE = 20;

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

function toDisplayRow(r) {
  return {
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
  };
}

export default function ProductsReport() {
  const [tab, setTab] = useState("products");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});
  const [exporting, setExporting] = useState(false);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    if (search.trim()) params.set("search", search.trim());
    Object.entries(colFilters).forEach(([key, value]) => {
      if (value && value.trim()) params.set(key, value.trim());
    });
    return params;
  }, [page, search, colFilters]);

  const load = useCallback(() => {
    api.get(`/inventory/product-report/?${queryParams}`).then((res) => {
      setRows(res.data.results.map(toDisplayRow));
      setCount(res.data.count);
    });
  }, [queryParams]);

  useEffect(load, [load]);

  const setColFilter = (key, value) => {
    setColFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), pageCount));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const filterParams = new URLSearchParams(queryParams);
      filterParams.set("page_size", "200");
      filterParams.delete("page");
      let url = `/inventory/product-report/?${filterParams}`;
      let all = [];
      while (url) {
        const res = await api.get(url);
        all = all.concat(res.data.results.map(toDisplayRow));
        url = res.data.next ? res.data.next.replace(api.defaults.baseURL, "") : null;
      }
      const header = COLUMNS.map((c) => c.label).join(",");
      const body = all.map((row) => COLUMNS.map((c) => csvEscape(row[c.key])).join(",")).join("\n");
      const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="tabs">
        <button
          className={`tab ${tab === "products" ? "active" : ""}`}
          onClick={() => setTab("products")}
        >
          Products
        </button>
        <button
          className={`tab ${tab === "brands" ? "active" : ""}`}
          onClick={() => setTab("brands")}
        >
          Brands
        </button>
      </div>

      {tab === "brands" ? (
        <Brands />
      ) : (
        <>
      <h2 className="page">Products ({count})</h2>
      <div className="card">
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Global search</label>
            <input
              value={search}
              placeholder="Search across all columns…"
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="field" style={{ alignSelf: "end", flex: 0 }}>
            <button className="ghost" onClick={exportCsv} disabled={exporting}>
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
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
              {rows.map((r) => (
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
              {rows.length === 0 && (
                <tr><td colSpan={COLUMNS.length} style={{ color: "#8a94a2" }}>No products match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button className="ghost small" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            ← Prev
          </button>
          <input
            className="slider"
            type="range"
            min={1}
            max={pageCount}
            value={page}
            onChange={(e) => goToPage(Number(e.target.value))}
          />
          <button className="ghost small" onClick={() => goToPage(page + 1)} disabled={page >= pageCount}>
            Next →
          </button>
          <span className="page-info">Page {page} / {pageCount}</span>
        </div>
      </div>
        </>
      )}
    </>
  );
}
