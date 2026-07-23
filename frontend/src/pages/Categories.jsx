import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
];

const emptyField = () => ({ key: "", label: "", type: "text" });
const emptyForm = () => ({ name: "", description: "", fields: [] });

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
  { key: "attribute_schema_text", label: "Custom fields" },
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

  const addField = () => setForm((f) => ({ ...f, fields: [...f.fields, emptyField()] }));
  const updateField = (idx, patch) =>
    setForm((f) => ({ ...f, fields: f.fields.map((row, i) => (i === idx ? { ...row, ...patch } : row)) }));
  const removeField = (idx) => setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));

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
      fields: (category.attribute_schema || []).map((f) => ({ ...f })),
    });
    setError("");
    setShowModal(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const attribute_schema = form.fields
      .filter((f) => f.key.trim())
      .map((f) => ({
        key: f.key.trim().toLowerCase().replace(/\s+/g, "_"),
        label: f.label.trim() || f.key.trim(),
        type: f.type,
      }));
    const payload = { name: form.name, description: form.description, attribute_schema };
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
        attribute_schema_text: (c.attribute_schema || []).map((f) => f.label).join("; "),
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

      <div className="card">
        <div className="row">
          <div style={{ flex: 1 }} />
          <div className="field" style={{ alignSelf: "end", flex: 0, display: "flex", gap: ".6rem" }}>
            <button onClick={openAdd}>+ Add Category</button>
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
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td style={{ color: "var(--text-secondary)" }} title={c.description}>{c.description || "—"}</td>
                  <td>
                    {(c.attribute_schema || []).length === 0
                      ? <span style={{ color: "var(--text-tertiary)" }}>—</span>
                      : c.attribute_schema.map((f) => (
                          <span key={f.key} className="badge gray" style={{ marginRight: ".3rem" }}>{f.label}</span>
                        ))}
                  </td>
                  <td>
                    <button className="ghost small" onClick={() => toggleActive(c)}>
                      <span className={`badge ${c.is_active ? "green" : "gray"}`}>
                        {c.is_active ? "active" : "inactive"}
                      </span>
                    </button>
                  </td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>{c.created_by_name || "—"}</td>
                  <td>{formatDate(c.updated_at)}</td>
                  <td>{c.updated_by_name || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: ".4rem", justifyContent: "center" }}>
                      <button className="icon-btn" title="Edit category" aria-label="Edit category" onClick={() => openEdit(c)}>
                        <Pencil size={15} />
                      </button>
                      <button className="icon-btn icon-btn-danger" title="Delete category" aria-label="Delete category" onClick={() => remove(c.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} style={{ color: "var(--text-tertiary)" }}>Nothing yet — add the first category above.</td></tr>
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

              <label style={{ marginTop: ".6rem" }}>Custom fields for this category's products</label>
              <p style={{ fontSize: ".85rem", color: "var(--text-tertiary)", marginBottom: ".8rem" }}>
                e.g. Mobiles → Storage, RAM, Color. AC → Tonnage, Energy rating. Fridge → Capacity (Liters).
              </p>
              {form.fields.map((f, idx) => (
                <div className="row" key={idx}>
                  <div className="field"><label>Field key</label>
                    <input value={f.key} placeholder="tonnage"
                      onChange={(e) => updateField(idx, { key: e.target.value })} /></div>
                  <div className="field"><label>Display label</label>
                    <input value={f.label} placeholder="Tonnage"
                      onChange={(e) => updateField(idx, { label: e.target.value })} /></div>
                  <div className="field"><label>Type</label>
                    <select value={f.type} onChange={(e) => updateField(idx, { type: e.target.value })}>
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select></div>
                  <div className="field" style={{ alignSelf: "end", flex: 0 }}>
                    <button type="button" className="danger small" onClick={() => removeField(idx)}>Remove</button>
                  </div>
                </div>
              ))}
              <div className="row" style={{ marginTop: ".4rem" }}>
                <button type="button" className="ghost small" onClick={addField}>+ Add field</button>
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
    </>
  );
}
