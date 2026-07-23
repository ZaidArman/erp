import { useEffect, useMemo, useState } from "react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [categories, setCategories] = useState([]);
  const [skus, setSkus] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [sForm, setSForm] = useState({ variant_name: "" });
  const [sAttrs, setSAttrs] = useState({});

  const loadProducts = () => {
    api.get(`/inventory/products/?page=${page}&page_size=${pageSize}`).then((res) => {
      setProducts(res.data.results);
      setCount(res.data.count);
    });
  };
  useEffect(() => {
    loadProducts();
    api.get("/inventory/categories/").then((res) => setCategories(res.data.results));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), pageCount));
  const changePageSize = (n) => { setPageSize(n); setPage(1); };

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

  const toggleActive = async (product) => {
    try {
      await api.patch(`/inventory/products/${product.id}/`, { is_active: !product.is_active });
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
        attributes,
      });
      setSForm({ variant_name: "" });
      setSAttrs({});
      openProduct(selected);
      loadProducts();
    } catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Products &amp; SKUs</h2>
      <Modal title={errorTitle(error)} message={error} onClose={() => setError("")} />
      <p style={{ fontSize: ".85rem", color: "#8a94a2", marginTop: "-.6rem", marginBottom: "1.1rem" }}>
        To add a new product, use the "+ Add Product" button on the Products page. Manage each
        product's SKU variants here.
      </p>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Category</th><th>Brand</th>
                <th>Selling price</th><th>Stock</th><th>SKUs</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.category_name}</td><td>{p.brand_name}</td>
                  <td>{p.selling_price ?? "—"}</td>
                  <td>
                    {p.current_stock}
                    {(p.minimum_stock || p.maximum_stock) && (
                      <span style={{ color: "#8a94a2", fontSize: ".78rem" }}>
                        {" "}({p.minimum_stock ?? "—"}–{p.maximum_stock ?? "—"})
                      </span>
                    )}
                  </td>
                  <td>{p.sku_count}</td>
                  <td>
                    <button className="ghost small" onClick={() => toggleActive(p)}>
                      <span className={`badge ${p.is_active ? "green" : "gray"}`}>
                        {p.is_active ? "active" : "inactive"}
                      </span>
                    </button>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="ghost small" onClick={() => openProduct(p)}>Manage SKUs</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={8} style={{ color: "#8a94a2" }}>
                  Nothing yet — add a product from the Products page first.
                </td></tr>
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

      {selected && (
        <div className="card">
          <h3>SKUs — {selected.name} <span style={{ color: "#8a94a2", fontWeight: 400 }}>({selected.category_name})</span></h3>
          <p style={{ fontSize: ".85rem", color: "#5c6673" }}>
            Sell price: <strong>{selected.selling_price ?? "not set — set it on the product first"}</strong>
          </p>
          <form className="row" onSubmit={createSku}>
            <div className="field"><label>Variant name</label>
              <input value={sForm.variant_name} placeholder="256GB Black"
                onChange={(e) => setSForm({ ...sForm, variant_name: e.target.value })} required /></div>
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
