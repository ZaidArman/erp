import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { api, errorText, errorTitle } from "../api";
import DetailModal from "../components/DetailModal";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";

const emptyForm = { name: "", category: "", description: "", supporter_phone_number: "" };
const emptyProductForm = () => ({ name: "", description: "" });

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "name", label: "Brand" },
  { key: "category_name", label: "Category" },
  { key: "description", label: "Description" },
  { key: "supporter_phone_number", label: "Support phone" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created at" },
  { key: "created_by_name", label: "Created by" },
  { key: "updated_at", label: "Updated at" },
  { key: "updated_by_name", label: "Updated by" },
];

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});

  const [viewing, setViewing] = useState(null);

  const [addProductFor, setAddProductFor] = useState(null);
  const [productForm, setProductForm] = useState(emptyProductForm());
  const [productError, setProductError] = useState("");
  const [productSaving, setProductSaving] = useState(false);

  const load = useCallback(() => {
    api.get(`/inventory/brands/?page=${page}&page_size=${pageSize}`).then((res) => {
      setBrands(res.data.results);
      setCount(res.data.count);
    });
  }, [page, pageSize]);

  useEffect(() => {
    load();
    api.get("/inventory/categories/?page_size=200").then((res) => setCategories(res.data.results));
  }, [load]);

  // Only active categories are selectable for new/changed assignments — but
  // keep the brand's current category visible in the dropdown even if it was
  // deactivated after assignment, so editing doesn't silently blank it out.
  const categoryOptions = categories.filter(
    (c) => c.is_active || String(c.id) === String(form.category)
  );

  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), pageCount));
  const changePageSize = (n) => { setPageSize(n); setPage(1); };
  const setColFilter = (key, value) => setColFilters((f) => ({ ...f, [key]: value }));

  const rows = useMemo(() => {
    return brands.map((b) => ({
      id: b.id,
      name: b.name || "",
      category_name: b.category_name || "",
      description: b.description || "",
      supporter_phone_number: b.supporter_phone_number || "",
      status: b.is_active ? "active" : "inactive",
      created_at: formatDate(b.created_at),
      created_by_name: b.created_by_name || "",
      updated_at: formatDate(b.updated_at),
      updated_by_name: b.updated_by_name || "",
      raw: b,
    }));
  }, [brands]);

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

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowAdd(true);
  };

  const openEdit = (brand) => {
    setEditingId(brand.id);
    setForm({
      name: brand.name || "",
      category: brand.category ?? "",
      description: brand.description || "",
      supporter_phone_number: brand.supporter_phone_number || "",
    });
    setError("");
    setShowAdd(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/inventory/brands/${editingId}/`, form);
      } else {
        await api.post("/inventory/brands/", form);
      }
      setShowAdd(false);
      load();
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this brand?")) return;
    try { await api.delete(`/inventory/brands/${id}/`); load(); }
    catch (err) { setError(errorText(err)); }
  };

  const openAddProduct = (brand) => {
    setAddProductFor(brand);
    setProductForm(emptyProductForm());
    setProductError("");
  };

  const submitProduct = async (e) => {
    e.preventDefault();
    setProductError("");
    setProductSaving(true);
    try {
      await api.post("/inventory/products/", { ...productForm, brand: addProductFor.id });
      setAddProductFor(null);
    } catch (err) { setProductError(errorText(err)); }
    finally { setProductSaving(false); }
  };

  const toggleActive = async (brand) => {
    try {
      await api.patch(`/inventory/brands/${brand.id}/`, { is_active: !brand.is_active });
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      let url = "/inventory/brands/?page_size=200";
      let all = [];
      while (url) {
        const res = await api.get(url);
        all = all.concat(res.data.results.map((b) => ({
          id: b.id,
          name: b.name || "",
          category_name: b.category_name || "",
          description: b.description || "",
          supporter_phone_number: b.supporter_phone_number || "",
          status: b.is_active ? "active" : "inactive",
          created_at: formatDate(b.created_at),
          created_by_name: b.created_by_name || "",
          updated_at: formatDate(b.updated_at),
          updated_by_name: b.updated_by_name || "",
        })));
        url = res.data.next ? res.data.next.replace(api.defaults.baseURL, "") : null;
      }
      const header = COLUMNS.map((c) => c.label).join(",");
      const body = all
        .map((row) => COLUMNS.map((c) => csvEscape(row[c.key])).join(","))
        .join("\n");
      const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `brands-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <h2 className="page">Brands</h2>
      <Modal title={errorTitle(error)} message={showAdd ? "" : error} onClose={() => setError("")} />

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
          <div className="field" style={{ alignSelf: "end", flex: 0, display: "flex", gap: ".6rem" }}>
            <button className="ghost" onClick={openAdd}>+ Add Brand</button>
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
                <th />
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
                  {COLUMNS.map((c) => {
                    if (c.key === "status") {
                      return (
                        <td key={c.key}>
                          <button className="ghost small" onClick={() => toggleActive(r.raw)}>
                            <span className={`badge ${r.status === "active" ? "green" : "gray"}`}>
                              {r.status}
                            </span>
                          </button>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} title={r[c.key] || undefined} style={c.key === "description" ? { color: "#5c6673" } : undefined}>
                        {r[c.key] || "—"}
                      </td>
                    );
                  })}
                  <td>
                    <div style={{ display: "flex", gap: ".4rem", justifyContent: "center" }}>
                      <button
                        className="icon-btn"
                        title="View brand"
                        aria-label="View brand"
                        onClick={() => setViewing(r)}
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Edit brand"
                        aria-label="Edit brand"
                        onClick={() => openEdit(r.raw)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Add product"
                        aria-label="Add product"
                        onClick={() => openAddProduct(r.raw)}
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        className="icon-btn icon-btn-danger"
                        title="Delete brand"
                        aria-label="Delete brand"
                        onClick={() => remove(r.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} style={{ color: "#8a94a2" }}>No brands match these filters.</td></tr>
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

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Edit Brand" : "Add Brand"}</h3>
            {error && <div className="error">{error}</div>}
            <form onSubmit={submitForm}>
              <div className="field"><label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                  <option value="">Select…</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{!c.is_active ? " (inactive)" : ""}</option>
                  ))}
                </select></div>
              <div className="field"><label>Brand name</label>
                <input value={form.name} placeholder="e.g. Apple"
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="field"><label>Description</label>
                <input value={form.description} placeholder="Optional"
                  onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="field"><label>Support phone</label>
                <input value={form.supporter_phone_number} placeholder="Optional"
                  onChange={(e) => setForm({ ...form, supporter_phone_number: e.target.value })} /></div>
              {categories.length === 0 && (
                <p style={{ fontSize: ".8rem", color: "#8a94a2" }}>Create a category first.</p>
              )}
              <div className="modal-form-actions">
                <button type="button" className="ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <DetailModal
          title={viewing.name}
          subtitle={viewing.category_name}
          onClose={() => setViewing(null)}
          fields={[
            { label: "Category", value: viewing.category_name },
            { label: "Description", value: viewing.description },
            { label: "Support phone", value: viewing.supporter_phone_number },
            { label: "Status", value: viewing.status },
            { label: "Created at", value: viewing.created_at },
            { label: "Created by", value: viewing.created_by_name },
            { label: "Updated at", value: viewing.updated_at },
            { label: "Updated by", value: viewing.updated_by_name },
          ]}
        />
      )}

      {addProductFor && (
        <div className="modal-overlay" onClick={() => setAddProductFor(null)}>
          <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
            <h3>Add Product — {addProductFor.name}</h3>
            {productError && <div className="error">{productError}</div>}
            <form onSubmit={submitProduct}>
              <div className="field"><label>Product name</label>
                <input value={productForm.name} placeholder="e.g. iPhone 15 Pro"
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /></div>
              <div className="field"><label>Description</label>
                <input value={productForm.description} placeholder="Optional"
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></div>
              <p style={{ fontSize: ".8rem", color: "var(--text-tertiary)" }}>
                More details (pricing, warranty, identity codes) can be added afterwards from the Products page.
              </p>
              <div className="modal-form-actions">
                <button type="button" className="ghost" onClick={() => setAddProductFor(null)}>Cancel</button>
                <button type="submit" disabled={productSaving}>{productSaving ? "Saving…" : "Add product"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
