import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorText } from "../api";
import Pagination from "../components/Pagination";

const COLUMNS = [
  { key: "product_name", label: "Product" },
  { key: "brand_name", label: "Brand" },
  { key: "sell_price", label: "Price" },
  { key: "imei_serial", label: "IMEI / serial" },
  { key: "branch_name", label: "Branch" },
  { key: "condition", label: "Condition" },
  { key: "status", label: "Status" },
];

const emptyWarrantyForm = { warrant_id: "", warranty_type: "manufacturer", duration_months: "", coverage: "", terms: "" };

export default function StockList() {
  const [units, setUnits] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState({ condition: "", is_sold: "false", imei: "" });
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});

  const [warrantyUnit, setWarrantyUnit] = useState(null);
  const [warranties, setWarranties] = useState([]);
  const [warrantyForm, setWarrantyForm] = useState(emptyWarrantyForm);
  const [warrantyError, setWarrantyError] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    if (filters.condition) params.set("condition", filters.condition);
    if (filters.is_sold) params.set("is_sold", filters.is_sold);
    if (filters.imei) params.set("imei", filters.imei.trim());
    api.get(`/inventory/stock-units/?${params}`).then((res) => {
      setUnits(res.data.results);
      setCount(res.data.count);
    });
  }, [page, pageSize, filters]);

  useEffect(load, [load]);

  const rows = useMemo(() => {
    return units.map((u) => ({
      id: u.id,
      product_name: u.product_name || "",
      brand_name: u.brand_name || "",
      sell_price: u.sell_price ?? "",
      imei_serial: u.imei_serial || "",
      branch_name: u.branch_name || "",
      condition: u.condition || "",
      status: u.is_sold ? "sold" : "in stock",
    }));
  }, [units]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
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
  }, [rows, search, colFilters]);

  const setColFilter = (key, value) => setColFilters((f) => ({ ...f, [key]: value }));
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), pageCount));
  const changePageSize = (n) => { setPageSize(n); setPage(1); };

  const openWarranty = (row) => {
    setWarrantyUnit(row);
    setWarrantyForm(emptyWarrantyForm);
    setWarrantyError("");
    api.get(`/inventory/stock-warranties/?stock_unit=${row.id}`).then((res) => setWarranties(res.data.results));
  };

  const closeWarranty = () => {
    setWarrantyUnit(null);
    setWarranties([]);
  };

  const addWarranty = async (e) => {
    e.preventDefault();
    setWarrantyError("");
    try {
      const payload = { stock_unit: warrantyUnit.id, ...warrantyForm };
      if (!payload.duration_months) delete payload.duration_months;
      await api.post("/inventory/stock-warranties/", payload);
      setWarrantyForm(emptyWarrantyForm);
      const res = await api.get(`/inventory/stock-warranties/?stock_unit=${warrantyUnit.id}`);
      setWarranties(res.data.results);
    } catch (err) { setWarrantyError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Stock ({count})</h2>
      <div className="card">
        <div className="row">
          <div className="field"><label>IMEI search (exact)</label>
            <input value={filters.imei} placeholder="358743110912345"
              onChange={(e) => { setFilters({ ...filters, imei: e.target.value }); setPage(1); }} /></div>
          <div className="field"><label>Condition</label>
            <select value={filters.condition} onChange={(e) => { setFilters({ ...filters, condition: e.target.value }); setPage(1); }}>
              <option value="">All</option>
              <option value="new">New</option>
              <option value="open_box">Open box</option>
              <option value="refurbished">Refurbished</option>
              <option value="used">Used</option>
            </select></div>
          <div className="field"><label>Status</label>
            <select value={filters.is_sold} onChange={(e) => { setFilters({ ...filters, is_sold: e.target.value }); setPage(1); }}>
              <option value="">All</option>
              <option value="false">In stock</option>
              <option value="true">Sold</option>
            </select></div>
        </div>
        <div className="field" style={{ marginTop: ".6rem" }}>
          <label>Search this page</label>
          <input
            value={search}
            placeholder="Search across product, brand, IMEI, branch…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
                <th>Warranty</th>
              </tr>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="col-filter">
                    <input
                      value={colFilters[c.key] || ""}
                      placeholder="Filter…"
                      onChange={(e) => setColFilter(c.key, e.target.value)}
                    />
                  </th>
                ))}
                <th className="col-filter" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id}>
                  <td title={r.product_name}>{r.product_name}</td>
                  <td title={r.brand_name}>{r.brand_name}</td>
                  <td>{r.sell_price}</td>
                  <td style={{ fontFamily: "monospace" }}>{r.imei_serial}</td>
                  <td title={r.branch_name}>{r.branch_name}</td>
                  <td><span className="badge gray">{r.condition}</span></td>
                  <td><span className={`badge ${r.status === "sold" ? "red" : "green"}`}>{r.status}</span></td>
                  <td>
                    <button className="ghost small" onClick={() => openWarranty(r)}>Warranty</button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} style={{ color: "#8a94a2" }}>No units match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          count={count}
          pageSize={pageSize}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      </div>

      {warrantyUnit && (
        <div className="modal-overlay" onClick={closeWarranty}>
          <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
            <h3>Warranty — {warrantyUnit.imei_serial}</h3>
            {warrantyError && <div className="error">{warrantyError}</div>}

            {warranties.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                {warranties.map((w) => (
                  <div key={w.id} className="card" style={{ padding: ".7rem .9rem", marginBottom: ".5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{w.warranty_type === "extended" ? "Extended" : "Manufacturer"}</strong>
                      <span className={`badge ${w.is_active ? "green" : "gray"}`}>{w.is_active ? "active" : "inactive"}</span>
                    </div>
                    {w.warrant_id && <div style={{ fontSize: ".8rem", color: "#5c6673" }}>ID: {w.warrant_id}</div>}
                    {w.duration_months && <div style={{ fontSize: ".8rem", color: "#5c6673" }}>{w.duration_months} months</div>}
                    {w.coverage && <div style={{ fontSize: ".8rem", color: "#5c6673" }}>Coverage: {w.coverage}</div>}
                    {w.terms && <div style={{ fontSize: ".8rem", color: "#5c6673" }}>{w.terms}</div>}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={addWarranty}>
              <div className="field"><label>Warranty ID</label>
                <input value={warrantyForm.warrant_id}
                  onChange={(e) => setWarrantyForm({ ...warrantyForm, warrant_id: e.target.value })} /></div>
              <div className="field"><label>Type</label>
                <select value={warrantyForm.warranty_type}
                  onChange={(e) => setWarrantyForm({ ...warrantyForm, warranty_type: e.target.value })}>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="extended">Extended</option>
                </select></div>
              <div className="field"><label>Duration (months)</label>
                <input type="number" min="0" value={warrantyForm.duration_months}
                  onChange={(e) => setWarrantyForm({ ...warrantyForm, duration_months: e.target.value })} /></div>
              <div className="field"><label>Coverage</label>
                <input value={warrantyForm.coverage} placeholder="e.g. Parts, Labor"
                  onChange={(e) => setWarrantyForm({ ...warrantyForm, coverage: e.target.value })} /></div>
              <div className="field"><label>Terms</label>
                <input value={warrantyForm.terms}
                  onChange={(e) => setWarrantyForm({ ...warrantyForm, terms: e.target.value })} /></div>
              <div className="modal-form-actions">
                <button type="button" className="ghost" onClick={closeWarranty}>Close</button>
                <button type="submit">Add warranty</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
