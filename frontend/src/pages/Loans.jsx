import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, Download, HandCoins } from "lucide-react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";

const RANGE_OPTIONS = [
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "180d", label: "180d", days: 180 },
  { key: "1y", label: "1y", days: 365 },
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

function fileTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [range, setRange] = useState("90d");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState("");

  const load = useCallback(() => {
    const days = RANGE_OPTIONS.find((r) => r.key === range)?.days ?? 90;
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    api.get(`/pos/sales/?outstanding=true&date_from=${dateFrom}&page_size=200`).then((res) => {
      setLoans(res.data.results);
    }).catch((err) => setError(errorText(err)));
  }, [range]);

  useEffect(load, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans
      .map((s) => ({
        id: s.id,
        customer_name: s.customer_name || "Walk-in customer",
        customer_phone: s.customer_phone || "",
        receipt_number: s.receipt?.receipt_number || "",
        branch_name: s.branch_name || "",
        created_at: formatDate(s.created_at),
        total_amount: Number(s.total_amount),
        amount_paid: Number(s.amount_paid),
        balance_due: Number(s.balance_due),
      }))
      .filter((r) => {
        if (!q) return true;
        return (
          r.customer_name.toLowerCase().includes(q) ||
          r.customer_phone.toLowerCase().includes(q) ||
          r.receipt_number.toLowerCase().includes(q)
        );
      });
  }, [loans, search]);

  const totalOutstanding = rows.reduce((sum, r) => sum + r.balance_due, 0);
  const customerCount = new Set(rows.map((r) => r.customer_phone || r.customer_name)).size;

  const openRecordPayment = (row) => {
    setPayTarget(row);
    setPayAmount("");
    setPayError("");
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setPayError("");
    setPaySaving(true);
    try {
      await api.post(`/pos/sales/${payTarget.id}/record-payment/`, { amount: payAmount });
      setPayTarget(null);
      load();
    } catch (err) {
      setPayError(errorText(err));
    } finally {
      setPaySaving(false);
    }
  };

  const exportCsv = () => {
    setExporting(true);
    try {
      const columns = [
        { key: "customer_name", label: "Customer" },
        { key: "customer_phone", label: "Phone" },
        { key: "receipt_number", label: "Receipt" },
        { key: "branch_name", label: "Branch" },
        { key: "created_at", label: "Sale date" },
        { key: "total_amount", label: "Total" },
        { key: "amount_paid", label: "Paid" },
        { key: "balance_due", label: "Balance due" },
      ];
      const header = columns.map((c) => c.label).join(",");
      const body = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(",")).join("\n");
      const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `outstanding_loans_${fileTimestamp()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <h2 className="page">Loans</h2>
      <Modal title={errorTitle(error)} message={error} onClose={() => setError("")} />

      <div
        className="card"
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(120deg, var(--warning-700, #b45309), var(--warning-500, #d97706))",
          color: "#fff", border: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: ".9rem" }}>
          <div style={{
            width: "2.4rem", height: "2.4rem", borderRadius: "var(--radius-lg)",
            background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <HandCoins size={19} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Outstanding Loans</div>
            <div style={{ fontSize: ".82rem", opacity: .85 }}>Customer loan records — from credit sales</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: ".7rem" }}>
          <div style={{ background: "rgba(255,255,255,.15)", borderRadius: "var(--radius-md)", padding: ".5rem .9rem", textAlign: "center" }}>
            <div style={{ fontSize: ".65rem", fontWeight: 700, letterSpacing: ".05em", opacity: .85 }}>TOTAL OUTSTANDING</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{totalOutstanding.toFixed(2)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,.15)", borderRadius: "var(--radius-md)", padding: ".5rem .9rem", textAlign: "center" }}>
            <div style={{ fontSize: ".65rem", fontWeight: 700, letterSpacing: ".05em", opacity: .85 }}>CUSTOMERS</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{customerCount}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".9rem", alignItems: "center" }}>
          <input
            style={{ flex: 1, minWidth: 220 }}
            value={search}
            placeholder="Search name, phone, receipt…"
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
            <span style={{ fontSize: ".82rem", color: "var(--text-tertiary)" }}>Last:</span>
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                className={range === r.key ? "" : "ghost"}
                style={{ whiteSpace: "nowrap", padding: ".4rem .8rem" }}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button className="ghost" style={{ whiteSpace: "nowrap" }} onClick={exportCsv} disabled={exporting || rows.length === 0}>
            <Download size={14} /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card empty-state">
          <div className="icon-wrap" style={{ background: "var(--success-50)", color: "var(--success-600)" }}>
            <CircleCheck size={20} />
          </div>
          <h4>No outstanding loans!</h4>
          <p>All sales in this period are settled.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer</th><th>Phone</th><th>Receipt</th><th>Branch</th>
                  <th>Sale date</th><th>Total</th><th>Paid</th><th>Balance due</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.customer_name}</td>
                    <td>{r.customer_phone || "—"}</td>
                    <td>{r.receipt_number || "—"}</td>
                    <td>{r.branch_name}</td>
                    <td>{r.created_at}</td>
                    <td>{r.total_amount.toFixed(2)}</td>
                    <td>{r.amount_paid.toFixed(2)}</td>
                    <td><b>{r.balance_due.toFixed(2)}</b></td>
                    <td>
                      <button className="ghost small" onClick={() => openRecordPayment(r)}>Record payment</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payTarget && (
        <div className="modal-overlay" onClick={() => setPayTarget(null)}>
          <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
            <h3>Record payment — {payTarget.customer_name}</h3>
            {payError && <div className="error">{payError}</div>}
            <p style={{ fontSize: ".85rem", color: "var(--text-secondary)" }}>
              Balance due: <strong>{payTarget.balance_due.toFixed(2)}</strong>
            </p>
            <form onSubmit={submitPayment}>
              <div className="field">
                <label>Amount received</label>
                <input
                  type="number" min="0.01" step="0.01" max={payTarget.balance_due}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required autoFocus
                />
              </div>
              <div className="modal-form-actions">
                <button type="button" className="ghost" onClick={() => setPayTarget(null)}>Cancel</button>
                <button type="submit" disabled={paySaving}>{paySaving ? "Saving…" : "Record payment"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
