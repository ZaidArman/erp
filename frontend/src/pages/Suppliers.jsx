import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import useClickOutside from "../hooks/useClickOutside";

const emptyForm = {
  name: "", code: "", contact: "", phone: "", email: "", city: "", country: "",
  address: "", license_no: "", tax_no: "", ntn: "", bank_account: "",
  payment_terms: "", credit_limit: "",
};

const COLUMNS = [
  { key: "code", label: "Code" },
  { key: "name", label: "Supplier Name" },
  { key: "contact", label: "Contact" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "license_no", label: "License No." },
  { key: "tax_no", label: "Tax No." },
  { key: "ntn", label: "NTN" },
  { key: "bank_account", label: "Bank Account" },
  { key: "payment_terms", label: "Payment Terms" },
  { key: "credit_limit", label: "Credit Limit" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
];

const CATALOG_COLUMNS = [
  { key: "product_code", label: "Product code" },
  { key: "product_name", label: "Product name" },
  { key: "brand_name", label: "Brand" },
  { key: "category_name", label: "Category" },
  { key: "supplier_cost", label: "Supplier cost" },
  { key: "notes", label: "Notes" },
  { key: "created_at", label: "Added" },
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

function fileTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function downloadCsv(filename, header, rows, columns) {
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function DropdownButton({ label, ghost, disabled, children }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="menu-wrap" ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={ghost ? "ghost" : ""}
        disabled={disabled}
        style={{ whiteSpace: "nowrap" }}
        onClick={() => setOpen((v) => !v)}
      >
        {label} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu-popover" style={{ minWidth: 200 }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export default function Suppliers() {
  const [tab, setTab] = useState("suppliers");

  // --- Suppliers tab ---
  const [suppliers, setSuppliers] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState("active"); // active | inactive | all
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    api.get(`/inventory/suppliers/?page=${page}&page_size=${pageSize}`).then((res) => {
      setSuppliers(res.data.results);
      setCount(res.data.count);
    });
  }, [page, pageSize]);

  useEffect(load, [load]);

  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), pageCount));
  const changePageSize = (n) => { setPageSize(n); setPage(1); };
  const setColFilter = (key, value) => setColFilters((f) => ({ ...f, [key]: value }));

  const rows = useMemo(() => {
    return suppliers.map((s) => ({
      id: s.id,
      code: s.code || "",
      name: s.name || "",
      contact: s.contact || "",
      phone: s.phone || "",
      email: s.email || "",
      city: s.city || "",
      country: s.country || "",
      license_no: s.license_no || "",
      tax_no: s.tax_no || "",
      ntn: s.ntn || "",
      bank_account: s.bank_account || "",
      payment_terms: s.payment_terms || "",
      credit_limit: s.credit_limit ?? "",
      status: s.is_active ? "active" : "inactive",
      created_at: formatDate(s.created_at),
      raw: s,
    }));
  }, [suppliers]);

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
    setForm(emptyForm);
    setError("");
    setShowAdd(true);
  };

  const openEdit = (supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name || "", code: supplier.code || "", contact: supplier.contact || "",
      phone: supplier.phone || "", email: supplier.email || "", city: supplier.city || "",
      country: supplier.country || "", address: supplier.address || "",
      license_no: supplier.license_no || "", tax_no: supplier.tax_no || "",
      ntn: supplier.ntn || "", bank_account: supplier.bank_account || "",
      payment_terms: supplier.payment_terms || "", credit_limit: supplier.credit_limit ?? "",
    });
    setError("");
    setShowAdd(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.credit_limit === "") delete payload.credit_limit;
      if (editingId) {
        await api.patch(`/inventory/suppliers/${editingId}/`, payload);
      } else {
        await api.post("/inventory/suppliers/", payload);
      }
      setShowAdd(false);
      load();
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this supplier? It will be hidden from lists, but its history stays on record.")) return;
    try { await api.delete(`/inventory/suppliers/${id}/`); load(); }
    catch (err) { setError(errorText(err)); }
  };

  const toggleActive = async (supplier) => {
    try {
      await api.patch(`/inventory/suppliers/${supplier.id}/`, { is_active: !supplier.is_active });
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const exportCsv = async (scope) => {
    setExporting(true);
    try {
      const header = COLUMNS.map((c) => c.label).join(",");
      let rowsToExport;
      if (scope === "filtered") {
        rowsToExport = filteredRows;
      } else {
        let url = "/inventory/suppliers/?page_size=200";
        let all = [];
        while (url) {
          const res = await api.get(url);
          all = all.concat(res.data.results.map((s) => ({
            code: s.code || "", name: s.name || "", contact: s.contact || "",
            phone: s.phone || "", email: s.email || "", city: s.city || "",
            country: s.country || "", license_no: s.license_no || "", tax_no: s.tax_no || "",
            ntn: s.ntn || "", bank_account: s.bank_account || "", payment_terms: s.payment_terms || "",
            credit_limit: s.credit_limit ?? "", status: s.is_active ? "active" : "inactive",
            created_at: formatDate(s.created_at),
          })));
          url = res.data.next ? res.data.next.replace(api.defaults.baseURL, "") : null;
        }
        rowsToExport = all;
      }
      downloadCsv(`${scope}_export_supplier_${fileTimestamp()}.csv`, header, rowsToExport, COLUMNS);
    } finally {
      setExporting(false);
    }
  };

  // --- Supplier Catalog tab ---
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ product: "", supplier_cost: "", notes: "" });
  const [catalogError, setCatalogError] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [catalogExporting, setCatalogExporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (tab === "catalog" && allSuppliers.length === 0) {
      api.get("/inventory/suppliers/?page_size=200").then((res) => setAllSuppliers(res.data.results));
    }
  }, [tab, allSuppliers.length]);

  const ensureProductsLoaded = () => {
    if (products.length === 0) {
      api.get("/inventory/products/?page_size=200").then((res) => setProducts(res.data.results));
    }
  };

  const loadCatalog = useCallback(() => {
    if (!selectedSupplierId) { setCatalogItems([]); return; }
    api.get(`/inventory/supplier-catalog-items/?supplier=${selectedSupplierId}`).then((res) => {
      setCatalogItems(res.data.results);
    });
  }, [selectedSupplierId]);

  useEffect(loadCatalog, [loadCatalog]);

  const catalogRows = useMemo(() => {
    return catalogItems.map((it) => ({
      id: it.id,
      product_code: it.product_code || "",
      product_name: it.product_name || "",
      brand_name: it.brand_name || "",
      category_name: it.category_name || "",
      supplier_cost: it.supplier_cost ?? "",
      notes: it.notes || "",
      created_at: formatDate(it.created_at),
    }));
  }, [catalogItems]);

  const filteredCatalogRows = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalogRows;
    return catalogRows.filter((row) =>
      CATALOG_COLUMNS.some((c) => String(row[c.key]).toLowerCase().includes(q))
    );
  }, [catalogRows, catalogSearch]);

  const openAddItem = () => {
    setItemForm({ product: "", supplier_cost: "", notes: "" });
    setCatalogError("");
    ensureProductsLoaded();
    setShowAddItem(true);
  };

  const submitItem = async (e) => {
    e.preventDefault();
    setCatalogError("");
    setCatalogSaving(true);
    try {
      const payload = { supplier: selectedSupplierId, product: itemForm.product, notes: itemForm.notes };
      if (itemForm.supplier_cost !== "") payload.supplier_cost = itemForm.supplier_cost;
      await api.post("/inventory/supplier-catalog-items/", payload);
      setShowAddItem(false);
      loadCatalog();
    } catch (err) { setCatalogError(errorText(err)); }
    finally { setCatalogSaving(false); }
  };

  const removeItem = async (id) => {
    if (!confirm("Remove this item from the supplier's catalog?")) return;
    try { await api.delete(`/inventory/supplier-catalog-items/${id}/`); loadCatalog(); }
    catch (err) { setCatalogError(errorText(err)); }
  };

  const triggerBulkImport = () => {
    if (!selectedSupplierId) { setCatalogError("Select a supplier first."); return; }
    ensureProductsLoaded();
    fileInputRef.current?.click();
  };

  const handleBulkImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setCatalogError("");
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV has no data rows.");
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const codeIdx = header.indexOf("product_code");
      const costIdx = header.indexOf("supplier_cost");
      const notesIdx = header.indexOf("notes");
      if (codeIdx === -1) throw new Error("CSV must have a product_code column.");

      const productsRes = products.length ? { data: { results: products } } : await api.get("/inventory/products/?page_size=200");
      const byCode = new Map(productsRes.data.results.map((p) => [String(p.product_code || "").toLowerCase(), p]));

      const items = [];
      const unmatched = [];
      for (const line of lines.slice(1)) {
        const cols = line.split(",");
        const code = (cols[codeIdx] || "").trim();
        const match = byCode.get(code.toLowerCase());
        if (!match) { unmatched.push(code); continue; }
        const row = { product: match.id };
        if (costIdx !== -1 && cols[costIdx]?.trim()) row.supplier_cost = cols[costIdx].trim();
        if (notesIdx !== -1 && cols[notesIdx]?.trim()) row.notes = cols[notesIdx].trim();
        items.push(row);
      }
      if (items.length === 0) throw new Error("No matching products found in the CSV.");

      const res = await api.post("/inventory/supplier-catalog-items/bulk-create/", {
        supplier: selectedSupplierId,
        items,
      });
      loadCatalog();
      const skippedCount = (res.data.skipped || []).length + unmatched.length;
      if (skippedCount > 0) {
        setCatalogError(
          `Imported ${res.data.created.length}, skipped ${skippedCount}` +
          (unmatched.length ? ` (unmatched codes: ${unmatched.join(", ")})` : "")
        );
      }
    } catch (err) {
      setCatalogError(err.message || errorText(err));
    } finally {
      setImporting(false);
    }
  };

  const exportCatalogCsv = async (scope) => {
    setCatalogExporting(true);
    try {
      const header = CATALOG_COLUMNS.map((c) => c.label).join(",");
      const rowsToExport = scope === "filtered" ? filteredCatalogRows : catalogRows;
      downloadCsv(`${scope}_export_supplier_${fileTimestamp()}.csv`, header, rowsToExport, CATALOG_COLUMNS);
    } finally {
      setCatalogExporting(false);
    }
  };

  const downloadCatalogTemplate = () => {
    // Matches SupplierCatalogItem's importable fields exactly (see
    // handleBulkImportFile) — product_code is Product's own field, the
    // other two are SupplierCatalogItem's own columns.
    const header = "product_code,supplier_cost,notes";
    const blob = new Blob([header + "\n"], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "supplier_catalog_import_template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const selectedSupplier = allSuppliers.find((s) => String(s.id) === String(selectedSupplierId));

  return (
    <>
      <div className="tabs">
        <button className={`tab ${tab === "suppliers" ? "active" : ""}`} onClick={() => setTab("suppliers")}>
          Suppliers
        </button>
        <button className={`tab ${tab === "catalog" ? "active" : ""}`} onClick={() => setTab("catalog")}>
          Supplier Catalog
        </button>
      </div>

      {tab === "suppliers" ? (
        <>
          <Modal title={errorTitle(error)} message={showAdd ? "" : error} onClose={() => setError("")} />
          <h2 className="page">Suppliers ({count})</h2>
          <div className="card">
            <div className="field" style={{ marginBottom: ".9rem" }}>
              <label>Global search</label>
              <input
                value={search}
                placeholder="Search by name, contact, city, phone…"
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
                <DropdownButton label={exporting ? "Exporting…" : "Export"} ghost disabled={exporting}>
                  {(close) => (
                    <>
                      <button type="button" className="menu-item" onClick={() => { exportCsv("all"); close(); }}>
                        Export (All)
                      </button>
                      <button type="button" className="menu-item" onClick={() => { exportCsv("filtered"); close(); }}>
                        Filtered Export
                      </button>
                    </>
                  )}
                </DropdownButton>
                <button style={{ whiteSpace: "nowrap" }} onClick={openAdd}>+ Add Supplier</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
                    <th>Actions</th>
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
                          <td key={c.key} title={r[c.key] || undefined}>
                            {r[c.key] || (r[c.key] === 0 ? 0 : "—")}
                          </td>
                        );
                      })}
                      <td>
                        <div style={{ display: "flex", gap: ".4rem", justifyContent: "center" }}>
                          <button className="icon-btn" title="Edit supplier" aria-label="Edit supplier" onClick={() => openEdit(r.raw)}>
                            <Pencil size={15} />
                          </button>
                          <button className="icon-btn icon-btn-danger" title="Delete supplier" aria-label="Delete supplier" onClick={() => remove(r.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={COLUMNS.length + 1} style={{ color: "#8a94a2" }}>No suppliers match these filters.</td></tr>
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
                <h3>{editingId ? "Edit Supplier" : "Add Supplier"}</h3>
                {error && <div className="error">{error}</div>}
                <form onSubmit={submitForm}>
                  <div className="row">
                    <div className="field"><label>Supplier name</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                    <div className="field"><label>Code</label>
                      <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                  </div>
                  <div className="row">
                    <div className="field"><label>Contact person</label>
                      <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
                    <div className="field"><label>Phone</label>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div className="field"><label>Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  </div>
                  <div className="row">
                    <div className="field"><label>City</label>
                      <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                    <div className="field"><label>Country</label>
                      <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                  </div>
                  <div className="field"><label>Address</label>
                    <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>

                  <label style={{ marginTop: ".4rem" }}>Compliance</label>
                  <div className="row">
                    <div className="field"><label>License no.</label>
                      <input value={form.license_no} onChange={(e) => setForm({ ...form, license_no: e.target.value })} /></div>
                    <div className="field"><label>Tax no.</label>
                      <input value={form.tax_no} onChange={(e) => setForm({ ...form, tax_no: e.target.value })} /></div>
                    <div className="field"><label>NTN</label>
                      <input value={form.ntn} onChange={(e) => setForm({ ...form, ntn: e.target.value })} /></div>
                  </div>

                  <label style={{ marginTop: ".4rem" }}>Financial</label>
                  <div className="row">
                    <div className="field"><label>Bank account</label>
                      <input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></div>
                    <div className="field"><label>Payment terms</label>
                      <input value={form.payment_terms} placeholder="e.g. Net 30" onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
                    <div className="field"><label>Credit limit</label>
                      <input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} /></div>
                  </div>

                  <div className="modal-form-actions">
                    <button type="button" className="ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                    <button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add supplier"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <Modal title={errorTitle(catalogError)} message={showAddItem ? "" : catalogError} onClose={() => setCatalogError("")} />
          <h2 className="page">Supplier Catalog</h2>
          <div className="card">
            <div className="row" style={{ marginBottom: ".9rem" }}>
              <div className="field"><label>Select supplier</label>
                <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                  <option value="">Select…</option>
                  {allSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{!s.is_active ? " (inactive)" : ""}</option>
                  ))}
                </select></div>
              <div className="field" style={{ flex: 2 }}><label>Search catalog</label>
                <input
                  value={catalogSearch}
                  placeholder="Code, description, manufacturer…"
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  disabled={!selectedSupplierId}
                /></div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: ".6rem" }}>
              <button onClick={openAddItem} disabled={!selectedSupplierId} style={{ whiteSpace: "nowrap" }}>+ Add Item</button>
              <DropdownButton label={importing ? "Importing…" : "Import"} ghost disabled={!selectedSupplierId || importing}>
                {(close) => (
                  <>
                    <button type="button" className="menu-item" onClick={() => { downloadCatalogTemplate(); close(); }}>
                      Import Template
                    </button>
                    <button type="button" className="menu-item" onClick={() => { triggerBulkImport(); close(); }}>
                      Import
                    </button>
                  </>
                )}
              </DropdownButton>
              <DropdownButton label={catalogExporting ? "Exporting…" : "Export"} ghost disabled={!selectedSupplierId || catalogExporting}>
                {(close) => (
                  <>
                    <button type="button" className="menu-item" onClick={() => { exportCatalogCsv("all"); close(); }}>
                      Export (All)
                    </button>
                    <button type="button" className="menu-item" onClick={() => { exportCatalogCsv("filtered"); close(); }}>
                      Filtered Export
                    </button>
                  </>
                )}
              </DropdownButton>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleBulkImportFile}
              />
            </div>
          </div>

          {!selectedSupplierId ? (
            <div className="card" style={{ textAlign: "center", color: "#8a94a2", padding: "2.5rem" }}>
              Select a supplier above to view or manage their catalog.
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {CATALOG_COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalogRows.map((r) => (
                      <tr key={r.id}>
                        {CATALOG_COLUMNS.map((c) => (
                          <td key={c.key} title={r[c.key] || undefined}>{r[c.key] || "—"}</td>
                        ))}
                        <td>
                          <button className="icon-btn icon-btn-danger" title="Remove item" aria-label="Remove item" onClick={() => removeItem(r.id)}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredCatalogRows.length === 0 && (
                      <tr><td colSpan={CATALOG_COLUMNS.length + 1} style={{ color: "#8a94a2" }}>
                        No catalog items yet — add items using "Add Item" or bulk import.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showAddItem && (
            <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
              <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
                <h3>Add Catalog Item — {selectedSupplier?.name}</h3>
                {catalogError && <div className="error">{catalogError}</div>}
                <form onSubmit={submitItem}>
                  <div className="field"><label>Product</label>
                    <select value={itemForm.product} onChange={(e) => setItemForm({ ...itemForm, product: e.target.value })} required>
                      <option value="">Select…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} {p.product_code ? `(${p.product_code})` : ""}</option>
                      ))}
                    </select></div>
                  <div className="row">
                    <div className="field"><label>Supplier cost</label>
                      <input type="number" min="0" step="0.01" value={itemForm.supplier_cost}
                        onChange={(e) => setItemForm({ ...itemForm, supplier_cost: e.target.value })} /></div>
                    <div className="field"><label>Notes</label>
                      <input value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} /></div>
                  </div>
                  <div className="modal-form-actions">
                    <button type="button" className="ghost" onClick={() => setShowAddItem(false)}>Cancel</button>
                    <button type="submit" disabled={catalogSaving}>{catalogSaving ? "Saving…" : "Add item"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
