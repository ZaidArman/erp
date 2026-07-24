import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { api, errorText, errorTitle } from "../api";
import DetailModal from "../components/DetailModal";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";

const emptyBrandForm = () => ({ name: "", description: "", supporter_phone_number: "" });

const emptyForm = () => ({ name: "", description: "" });

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "name", label: "Category" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created at" },
  { key: "created_by_name", label: "Created by" },
  { key: "updated_at", label: "Updated at" },
  { key: "updated_by_name", label: "Updated by" },
];

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [viewing, setViewing] = useState(null);

  const [addBrandFor, setAddBrandFor] = useState(null);
  const [brandForm, setBrandForm] = useState(emptyBrandForm());
  const [brandError, setBrandError] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all"); // active | inactive | all
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});

  const load = useCallback(() => {
    api.get(`/inventory/categories/?page=${page}&page_size=${pageSize}`).then((res) => {
      setCategories(res.data.results);
      setCount(res.data.count);
    });
  }, [page, pageSize]);

  useEffect(load, [load]);

  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), pageCount));
  const changePageSize = (n) => { setPageSize(n); setPage(1); };
  const setColFilter = (key, value) => setColFilters((f) => ({ ...f, [key]: value }));

  const rows = useMemo(() => {
    return categories.map((c) => ({
      id: c.id,
      name: c.name || "",
      description: c.description || "",
      status: c.is_active ? "active" : "inactive",
      created_at: formatDate(c.created_at),
      created_by_name: c.created_by_name || "",
      updated_at: formatDate(c.updated_at),
      updated_by_name: c.updated_by_name || "",
      raw: c,
    }));
  }, [categories]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
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
  }, [rows, search, colFilters, statusFilter]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowModal(true);
  };

  const openEdit = (category) => {
    setEditingId(category.id);
    setForm({
      name: category.name || "",
      description: category.description || "",
    });
    setError("");
    setShowModal(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = { name: form.name, description: form.description };
    try {
      if (editingId) {
        await api.patch(`/inventory/categories/${editingId}/`, payload);
        setSuccess("Category updated successfully.");
      } else {
        await api.post("/inventory/categories/", payload);
        setSuccess("Category created successfully.");
      }
      setShowModal(false);
      load();
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this category?")) return;
    try {
      await api.delete(`/inventory/categories/${id}/`);
      setSuccess("Category deleted successfully.");
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const openAddBrand = (category) => {
    setAddBrandFor(category);
    setBrandForm(emptyBrandForm());
    setBrandError("");
  };

  const submitBrand = async (e) => {
    e.preventDefault();
    setBrandError("");
    setBrandSaving(true);
    try {
      await api.post("/inventory/brands/", { ...brandForm, category: addBrandFor.id });
      setSuccess(`Brand added under "${addBrandFor.name}".`);
      setAddBrandFor(null);
    } catch (err) { setBrandError(errorText(err)); }
    finally { setBrandSaving(false); }
  };

  const toggleActive = async (category) => {
    try {
      await api.patch(`/inventory/categories/${category.id}/`, { is_active: !category.is_active });
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      let url = "/inventory/categories/?page_size=200";
      let all = [];
      while (url) {
        const res = await api.get(url);
        all = all.concat(res.data.results);
        url = res.data.next ? res.data.next.replace(api.defaults.baseURL, "") : null;
      }
      const rows = all.map((c) => ({
        id: c.id,
        name: c.name || "",
        description: c.description || "",
        status: c.is_active ? "active" : "inactive",
        created_at: formatDate(c.created_at),
        created_by_name: c.created_by_name || "",
        updated_at: formatDate(c.updated_at),
        updated_by_name: c.updated_by_name || "",
      }));
      const header = COLUMNS.map((c) => c.label).join(",");
      const body = rows.map((row) => COLUMNS.map((c) => csvEscape(row[c.key])).join(",")).join("\n");
      const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `categories-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <h2 className="page">Categories</h2>
      <Modal title={errorTitle(error)} message={error} onClose={() => setError("")} />
      <Modal title="Success" message={success} onClose={() => setSuccess("")} />

      <div
        className="card"
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(120deg, var(--brand-700, #1d4ed8), var(--brand-500, #3b82f6))",
          color: "#fff", border: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: ".9rem" }}>
          <div style={{
            width: "2.4rem", height: "2.4rem", borderRadius: "var(--radius-lg)",
            background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Tags size={19} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Categories</div>
            <div style={{ fontSize: ".82rem", opacity: .85 }}>Group your products and drive brand/SKU organization</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,.15)", borderRadius: "var(--radius-md)", padding: ".5rem .9rem", textAlign: "center" }}>
          <div style={{ fontSize: ".65rem", fontWeight: 700, letterSpacing: ".05em", opacity: .85 }}>TOTAL</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{count}</div>
        </div>
      </div>

      <div className="card">
        <div className="field" style={{ marginBottom: ".9rem" }}>
          <label>Global search</label>
          <input
            value={search}
            placeholder="Search by name, description…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: ".6rem" }}>
          <div style={{ display: "flex", gap: ".4rem" }}>
            {["active", "inactive", "all"].map((s) => (
              <button
                key={s}
                type="button"
                className={statusFilter === s ? "" : "ghost"}
                style={{ whiteSpace: "nowrap" }}
                onClick={() => setStatusFilter(s)}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: ".6rem" }}>
            <button className="ghost" style={{ whiteSpace: "nowrap" }} onClick={exportCsv} disabled={exporting}>
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button style={{ whiteSpace: "nowrap" }} onClick={openAdd}>+ Add Category</button>
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
              {filteredRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td style={{ color: "var(--text-secondary)" }} title={r.description}>{r.description || "—"}</td>
                  <td>
                    <button className="ghost small" onClick={() => toggleActive(r.raw)}>
                      <span className={`badge ${r.status === "active" ? "green" : "gray"}`}>
                        {r.status}
                      </span>
                    </button>
                  </td>
                  <td>{r.created_at}</td>
                  <td>{r.created_by_name || "—"}</td>
                  <td>{r.updated_at}</td>
                  <td>{r.updated_by_name || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: ".4rem", justifyContent: "center" }}>
                      <button className="icon-btn" title="View category" aria-label="View category" onClick={() => setViewing(r.raw)}>
                        <Eye size={15} />
                      </button>
                      <button className="icon-btn" title="Edit category" aria-label="Edit category" onClick={() => openEdit(r.raw)}>
                        <Pencil size={15} />
                      </button>
                      <button className="icon-btn" title="Add brand" aria-label="Add brand" onClick={() => openAddBrand(r.raw)}>
                        <Plus size={15} />
                      </button>
                      <button className="icon-btn icon-btn-danger" title="Delete category" aria-label="Delete category" onClick={() => remove(r.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} style={{ color: "var(--text-tertiary)" }}>No categories match these filters.</td></tr>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Edit Category" : "Add Category"}</h3>
            {error && <div className="error">{error}</div>}
            <form onSubmit={submitForm}>
              <div className="row">
                <div className="field"><label>Category name</label>
                  <input value={form.name} placeholder="e.g. Air Conditioners"
                    onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="field"><label>Description</label>
                  <input value={form.description} placeholder="e.g. Electronics, Home Appliances"
                    onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>

              <div className="modal-form-actions">
                <button type="button" className="ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <DetailModal
          title={viewing.name}
          onClose={() => setViewing(null)}
          fields={[
            { label: "Description", value: viewing.description },
            { label: "Status", value: viewing.is_active ? "Active" : "Inactive" },
            { label: "Created at", value: formatDate(viewing.created_at) },
            { label: "Created by", value: viewing.created_by_name },
            { label: "Updated at", value: formatDate(viewing.updated_at) },
            { label: "Updated by", value: viewing.updated_by_name },
          ]}
        />
      )}

      {addBrandFor && (
        <div className="modal-overlay" onClick={() => setAddBrandFor(null)}>
          <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
            <h3>Add Brand — {addBrandFor.name}</h3>
            {brandError && <div className="error">{brandError}</div>}
            <form onSubmit={submitBrand}>
              <div className="field"><label>Brand name</label>
                <input value={brandForm.name} placeholder="e.g. Apple"
                  onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} required /></div>
              <div className="field"><label>Description</label>
                <input value={brandForm.description} placeholder="Optional"
                  onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })} /></div>
              <div className="field"><label>Support phone</label>
                <input value={brandForm.supporter_phone_number} placeholder="Optional"
                  onChange={(e) => setBrandForm({ ...brandForm, supporter_phone_number: e.target.value })} /></div>
              <div className="modal-form-actions">
                <button type="button" className="ghost" onClick={() => setAddBrandFor(null)}>Cancel</button>
                <button type="submit" disabled={brandSaving}>{brandSaving ? "Saving…" : "Add brand"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
