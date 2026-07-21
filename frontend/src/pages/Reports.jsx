import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../api";

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [stockValue, setStockValue] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    api.get(`/finance/summary/?period=custom&start=${start}&end=${end}`)
      .then((res) => setSummary(res.data))
      .catch((err) => setError(errorText(err)));
    api.get("/finance/stock-value/").then((res) => setStockValue(res.data)).catch(() => {});
  }, [start, end]);

  useEffect(load, [load]);

  const downloadCsv = async () => {
    setError("");
    try {
      const res = await api.get(
        `/finance/sales-report/export/?period=custom&start=${start}&end=${end}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-report-${start}-to-${end}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <h2 className="page">Reports</h2>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3>Sales report</h3>
        <div className="row">
          <div className="field"><label>From</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label>To</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div className="field" style={{ alignSelf: "end", flex: 0 }}>
            <button onClick={downloadCsv}>Download CSV</button>
          </div>
        </div>
        {summary && (
          <div className="metrics" style={{ marginTop: ".8rem", marginBottom: 0 }}>
            <div className="metric"><div className="label">Revenue</div>
              <div className="value">{summary.revenue}</div></div>
            <div className="metric"><div className="label">COGS</div>
              <div className="value">{summary.cogs}</div></div>
            <div className="metric"><div className="label">Gross profit</div>
              <div className="value" style={{ color: "#1d7a46" }}>{summary.gross_profit}</div></div>
            <div className="metric"><div className="label">Units sold</div>
              <div className="value">{summary.units_sold}</div></div>
          </div>
        )}
      </div>

      {stockValue && (
        <div className="card">
          <h3>Current stock value (unsold units, at purchase cost)</h3>
          <div className="metrics" style={{ marginBottom: ".8rem" }}>
            <div className="metric"><div className="label">Total stock value</div>
              <div className="value">{stockValue.total_value}</div></div>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <table>
                <thead><tr><th>Branch</th><th>Units</th>
                  <th style={{ textAlign: "right" }}>Value</th></tr></thead>
                <tbody>
                  {stockValue.per_branch.map((row) => (
                    <tr key={row.branch_name}>
                      <td>{row.branch_name}</td><td>{row.units}</td>
                      <td style={{ textAlign: "right" }}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ flex: 1 }}>
              <table>
                <thead><tr><th>Category</th><th>Units</th>
                  <th style={{ textAlign: "right" }}>Value</th></tr></thead>
                <tbody>
                  {stockValue.per_category.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td><td>{row.units}</td>
                      <td style={{ textAlign: "right" }}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
