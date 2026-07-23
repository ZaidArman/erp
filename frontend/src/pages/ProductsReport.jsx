import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api, errorText } from "../api";
import Brands from "./Brands";
import Pagination from "../components/Pagination";

const COLUMNS = [
  { key: "product_name", label: "Product" },
  { key: "category_name", label: "Category" },
  { key: "brand_name", label: "Brand" },
  { key: "model_number", label: "Model number" },
  { key: "product_code", label: "Product code" },
  { key: "barcode", label: "Barcode" },
  { key: "product_color", label: "Color" },
  { key: "imei_serial", label: "Serial number" },
  { key: "sell_price", label: "Sell price (SKU)" },
  { key: "purchase_cost", label: "Purchase (unit)" },
  { key: "selling_price", label: "Selling price" },
  { key: "cost_price", label: "Cost price" },
  { key: "purchase_price", label: "Purchase price" },
  { key: "profit_margin", label: "Profit margin" },
  { key: "minimum_stock", label: "Min stock" },
  { key: "maximum_stock", label: "Max stock" },
  { key: "warranty_required", label: "Warranty req." },
  { key: "warranty_period", label: "Warranty (mo)" },
  { key: "warranty_terms", label: "Warranty terms" },
  { key: "product_is_active", label: "Status" },
  { key: "created_at", label: "Created date" },
  { key: "updated_at", label: "Updated date" },
  { key: "created_by_name", label: "Created by" },
  { key: "updated_by_name", label: "Updated by" },
  { key: "product_updated_at", label: "Product updated" },
  { key: "product_updated_by_name", label: "Product updated by" },
];

const emptyProductForm = {
  name: "", brand: "", description: "",
  model_number: "", product_code: "", barcode: "", qr_code: "",
  warranty_required: false, warranty_period: "", warranty_terms: "",
  minimum_stock: "", maximum_stock: "", product_color: "",
  purchase_price: "", cost_price: "", selling_price: "",
};

function cleanPayload(form) {
  const payload = {};
  Object.entries(form).forEach(([key, value]) => {
    if (value === "" || value === null) return;
    payload[key] = value;
  });
  return payload;
}

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
    model_number: r.model_number || "",
    product_code: r.product_code || "",
    barcode: r.barcode || "",
    product_color: r.product_color || "",
    imei_serial: r.imei_serial || "",
    sell_price: r.sell_price ?? "",
    purchase_cost: r.purchase_cost ?? "",
    selling_price: r.selling_price ?? "",
    cost_price: r.cost_price ?? "",
    purchase_price: r.purchase_price ?? "",
    profit_margin: r.profit_margin ?? "",
    minimum_stock: r.minimum_stock ?? "",
    maximum_stock: r.maximum_stock ?? "",
    warranty_required: r.warranty_required ? "yes" : "no",
    warranty_period: r.warranty_period ?? "",
    warranty_terms: r.warranty_terms || "",
    product_is_active: r.product_is_active ? "active" : "inactive",
    created_at: formatDate(r.created_at),
    updated_at: formatDate(r.updated_at),
    created_by_name: r.created_by_name || "",
    updated_by_name: r.updated_by_name || "",
    product_updated_at: formatDate(r.product_updated_at),
    product_updated_by_name: r.product_updated_by_name || "",
  };
}

export default function ProductsReport() {
  const [tab, setTab] = useState("products");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});
  const [exporting, setExporting] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [brands, setBrands] = useState([]);
  const [pForm, setPForm] = useState(emptyProductForm);
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    if (search.trim()) params.set("search", search.trim());
    Object.entries(colFilters).forEach(([key, value]) => {
      if (value && value.trim()) params.set(key, value.trim());
    });
    return params;
  }, [page, pageSize, search, colFilters]);

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

  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), pageCount));
  const changePageSize = (n) => { setPageSize(n); setPage(1); };

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

  const ensureBrandsLoaded = () => {
    if (brands.length === 0) {
      api.get("/inventory/brands/?page_size=200").then((res) => setBrands(res.data.results));
    }
  };

  const openAddProduct = () => {
    setEditingId(null);
    setPForm(emptyProductForm);
    setAddError("");
    setShowProductModal(true);
    ensureBrandsLoaded();
  };

  const openEditProduct = async (productId) => {
    setEditingId(productId);
    setAddError("");
    ensureBrandsLoaded();
    const res = await api.get(`/inventory/products/${productId}/`);
    const p = res.data;
    setPForm({
      name: p.name || "", brand: p.brand ?? "", description: p.description || "",
      model_number: p.model_number || "", product_code: p.product_code || "",
      barcode: p.barcode || "", qr_code: p.qr_code || "",
      warranty_required: !!p.warranty_required, warranty_period: p.warranty_period ?? "",
      warranty_terms: p.warranty_terms || "",
      minimum_stock: p.minimum_stock ?? "", maximum_stock: p.maximum_stock ?? "",
      product_color: p.product_color || "",
      purchase_price: p.purchase_price ?? "", cost_price: p.cost_price ?? "",
      selling_price: p.selling_price ?? "",
    });
    setShowProductModal(true);
  };

  const deleteProduct = async (productId) => {
    if (!confirm("Delete this product? It will be hidden from lists, but its history stays on record.")) return;
    try {
      await api.delete(`/inventory/products/${productId}/`);
      load();
    } catch (err) {
      alert(errorText(err));
    }
  };

  const selectedBrand = brands.find((b) => String(b.id) === String(pForm.brand));
  // Only active brands are selectable — but keep the product's current brand
  // visible even if it was deactivated after assignment, so editing doesn't
  // silently blank it out.
  const brandOptions = brands.filter((b) => b.is_active || String(b.id) === String(pForm.brand));

  const previewMargin = useMemo(() => {
    const selling = parseFloat(pForm.selling_price);
    const cost = parseFloat(pForm.cost_price);
    if (Number.isNaN(selling) || Number.isNaN(cost)) return null;
    return (selling - cost).toFixed(2);
  }, [pForm.selling_price, pForm.cost_price]);

  const submitProduct = async (e) => {
    e.preventDefault();
    setAddError("");
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/inventory/products/${editingId}/`, cleanPayload(pForm));
      } else {
        await api.post("/inventory/products/", cleanPayload(pForm));
      }
      setShowProductModal(false);
      load();
    } catch (err) {
      setAddError(errorText(err));
    } finally {
      setSaving(false);
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
              <div className="field" style={{ alignSelf: "end", flex: 0, display: "flex", gap: ".6rem" }}>
                <button className="ghost" onClick={openAddProduct}>+ Add Product</button>
                <button className="ghost" onClick={exportCsv} disabled={exporting}>
                  {exporting ? "Exporting…" : "Export CSV"}
                </button>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
                    <th>Action</th>
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
                  {rows.map((r) => (
                    <tr key={r.id}>
                      {COLUMNS.map((c) => (
                        <td
                          key={c.key}
                          title={r[c.key] || undefined}
                          style={c.key === "imei_serial" ? { fontFamily: "monospace" } : undefined}
                        >
                          {r[c.key] || (r[c.key] === 0 ? 0 : "—")}
                        </td>
                      ))}
                      <td>
                        <div style={{ display: "flex", gap: ".4rem", justifyContent: "center" }}>
                          <button
                            className="icon-btn"
                            title="Edit product"
                            aria-label="Edit product"
                            onClick={() => openEditProduct(r.product_id)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn icon-btn-danger"
                            title="Delete product"
                            aria-label="Delete product"
                            onClick={() => deleteProduct(r.product_id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={COLUMNS.length + 1} style={{ color: "#8a94a2" }}>No products match these filters.</td></tr>
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
        </>
      )}

      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Edit Product" : "Add Product"}</h3>
            {addError && <div className="error">{addError}</div>}
            <form onSubmit={submitProduct}>
              <div className="row">
                <div className="field"><label>Name</label>
                  <input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} required /></div>
                <div className="field"><label>Brand</label>
                  <select value={pForm.brand} onChange={(e) => setPForm({ ...pForm, brand: e.target.value })} required>
                    <option value="">Select…</option>
                    {brandOptions.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}{!b.is_active ? " (inactive)" : ""}</option>
                    ))}
                  </select></div>
              </div>
              <div className="row">
                <div className="field"><label>Category</label>
                  <input value={selectedBrand?.category_name || ""} placeholder="Follows brand" disabled /></div>
                <div className="field"><label>Description</label>
                  <input value={pForm.description} onChange={(e) => setPForm({ ...pForm, description: e.target.value })} /></div>
              </div>

              <label style={{ marginTop: ".4rem" }}>Identity</label>
              <div className="row">
                <div className="field"><label>Model number</label>
                  <input value={pForm.model_number} placeholder="e.g. Samsung AC 1.5 Ton"
                    onChange={(e) => setPForm({ ...pForm, model_number: e.target.value })} /></div>
                <div className="field"><label>Product code</label>
                  <input value={pForm.product_code} placeholder="e.g. AC001"
                    onChange={(e) => setPForm({ ...pForm, product_code: e.target.value })} /></div>
              </div>
              <div className="row">
                <div className="field"><label>Barcode</label>
                  <input value={pForm.barcode}
                    onChange={(e) => setPForm({ ...pForm, barcode: e.target.value })} /></div>
                <div className="field"><label>QR code</label>
                  <input value={pForm.qr_code}
                    onChange={(e) => setPForm({ ...pForm, qr_code: e.target.value })} /></div>
                <div className="field"><label>Color</label>
                  <input value={pForm.product_color}
                    onChange={(e) => setPForm({ ...pForm, product_color: e.target.value })} /></div>
              </div>

              <label style={{ marginTop: ".4rem" }}>Warranty</label>
              <div className="row">
                <div className="field" style={{ minWidth: "auto" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
                    <input type="checkbox" style={{ width: "auto" }}
                      checked={pForm.warranty_required}
                      onChange={(e) => setPForm({ ...pForm, warranty_required: e.target.checked })} />
                    Required
                  </label>
                </div>
                <div className="field"><label>Period (months)</label>
                  <input type="number" min="0" value={pForm.warranty_period}
                    onChange={(e) => setPForm({ ...pForm, warranty_period: e.target.value })} /></div>
                <div className="field"><label>Terms</label>
                  <input value={pForm.warranty_terms}
                    onChange={(e) => setPForm({ ...pForm, warranty_terms: e.target.value })} /></div>
              </div>

              <label style={{ marginTop: ".4rem" }}>Stock thresholds</label>
              <div className="row">
                <div className="field"><label>Minimum stock</label>
                  <input type="number" min="0" value={pForm.minimum_stock}
                    onChange={(e) => setPForm({ ...pForm, minimum_stock: e.target.value })} /></div>
                <div className="field"><label>Maximum stock</label>
                  <input type="number" min="0" value={pForm.maximum_stock}
                    onChange={(e) => setPForm({ ...pForm, maximum_stock: e.target.value })} /></div>
              </div>

              <label style={{ marginTop: ".4rem" }}>Pricing</label>
              <p style={{ fontSize: ".78rem", color: "#8a94a2", marginBottom: ".6rem" }}>
                Price lives on the Product — SKUs and stock intake inherit it automatically.
              </p>
              <div className="row">
                <div className="field"><label>Purchase price</label>
                  <input type="number" min="0" step="0.01" value={pForm.purchase_price}
                    onChange={(e) => setPForm({ ...pForm, purchase_price: e.target.value })} /></div>
                <div className="field"><label>Cost price</label>
                  <input type="number" min="0" step="0.01" value={pForm.cost_price}
                    onChange={(e) => setPForm({ ...pForm, cost_price: e.target.value })} /></div>
              </div>
              <div className="row">
                <div className="field"><label>Selling price</label>
                  <input type="number" min="0" step="0.01" value={pForm.selling_price}
                    onChange={(e) => setPForm({ ...pForm, selling_price: e.target.value })} /></div>
                <div className="field"><label>Profit margin</label>
                  <input value={previewMargin ?? ""} placeholder="Auto" disabled /></div>
              </div>

              <div className="modal-form-actions">
                <button type="button" className="ghost" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add product"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
