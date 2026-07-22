import { useEffect, useMemo, useState } from "react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [skus, setSkus] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [pForm, setPForm] = useState({ name: "", brand: "", description: "" });
  const [sForm, setSForm] = useState({ variant_name: "", sell_price: "" });
  const [sAttrs, setSAttrs] = useState({});

  const loadProducts = () => api.get("/inventory/products/").then((res) => setProducts(res.data.results));
  useEffect(() => {
    loadProducts();
    api.get("/inventory/brands/").then((res) => setBrands(res.data.results));
    api.get("/inventory/categories/").then((res) => setCategories(res.data.results));
  }, []);

  const selectedBrand = brands.find((b) => String(b.id) === String(pForm.brand));

  const selectedCategorySchema = useMemo(() => {
    if (!selected) return [];
    const cat = categories.find((c) => c.id === selected.category);
    return cat?.attribute_schema || [];
  }, [selected, categories]);

  const openProduct = (product) => {
    setSelected(product);
    setSAttrs({});
    api.get(`/inventory/skus/?product=${product.id}`).then((res) => setSkus(res.data.results));
  };

  const createProduct = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/inventory/products/", pForm);
      setPForm({ name: "", brand: "", description: "" });
      loadProducts();
    } catch (err) { setError(errorText(err)); }
  };

  const createSku = async (e) => {
    e.preventDefault();
    setError("");
    const attributes = {};
    selectedCategorySchema.forEach((f) => {
      if (sAttrs[f.key]) attributes[f.key] = sAttrs[f.key];
    });
    try {
      await api.post("/inventory/skus/", {
        product: selected.id,
        variant_name: sForm.variant_name,
        sell_price: sForm.sell_price,
        attributes,
      });
      setSForm({ variant_name: "", sell_price: "" });
      setSAttrs({});
      openProduct(selected);
      loadProducts();
    } catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Products &amp; SKUs</h2>
      <Modal title={errorTitle(error)} message={error} onClose={() => setError("")} />
      <div className="card">
        <h3>New product</h3>
        <form className="row" onSubmit={createProduct}>
          <div className="field"><label>Name</label>
            <input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} required /></div>
          <div className="field"><label>Brand</label>
            <select value={pForm.brand} onChange={(e) => setPForm({ ...pForm, brand: e.target.value })} required>
              <option value="">Select…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div className="field"><label>Category</label>
            <input value={selectedBrand?.category_name || ""} placeholder="Follows brand" disabled /></div>
          <div className="field" style={{ alignSelf: "end", flex: 0 }}><button>Add</button></div>
        </form>
        {brands.length === 0 && (
          <p style={{ fontSize: ".8rem", color: "#8a94a2" }}>Create categories and brands first.</p>
        )}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>SKUs</th><th /></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.category_name}</td><td>{p.brand_name}</td><td>{p.sku_count}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="ghost small" onClick={() => openProduct(p)}>Manage SKUs</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <h3>SKUs — {selected.name} <span style={{ color: "#8a94a2", fontWeight: 400 }}>({selected.category_name})</span></h3>
          <form className="row" onSubmit={createSku}>
            <div className="field"><label>Variant name</label>
              <input value={sForm.variant_name} placeholder="256GB Black"
                onChange={(e) => setSForm({ ...sForm, variant_name: e.target.value })} required /></div>
            <div className="field"><label>Sell price</label>
              <input type="number" min="1" step="0.01" value={sForm.sell_price}
                onChange={(e) => setSForm({ ...sForm, sell_price: e.target.value })} required /></div>
            {selectedCategorySchema.map((f) => (
              <div className="field" key={f.key}><label>{f.label}</label>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={sAttrs[f.key] || ""}
                  onChange={(e) => setSAttrs({ ...sAttrs, [f.key]: e.target.value })}
                /></div>
            ))}
            <div className="field" style={{ alignSelf: "end", flex: 0 }}><button>Add SKU</button></div>
          </form>
          {selectedCategorySchema.length === 0 && (
            <p style={{ fontSize: ".78rem", color: "#8a94a2" }}>
              This category has no custom fields yet — add some on the Categories page.
            </p>
          )}
          <table>
            <thead><tr><th>Variant</th><th>Sell price</th><th>Attributes</th><th>Available units</th></tr></thead>
            <tbody>
              {skus.map((s) => (
                <tr key={s.id}>
                  <td>{s.variant_name}</td><td>{s.sell_price}</td>
                  <td style={{ fontSize: ".8rem", color: "#5c6673" }}>
                    {Object.entries(s.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
                  </td>
                  <td>{s.available_units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
