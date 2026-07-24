export default function DetailModal({ title, subtitle, fields, onClose }) {
  if (!fields) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-form" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {subtitle && (
          <p style={{ fontSize: ".85rem", color: "var(--text-tertiary)", marginTop: "-.6rem" }}>{subtitle}</p>
        )}
        <div className="detail-grid">
          {fields.map((f) => (
            <div className="detail-row" key={f.label}>
              <div className="detail-label">{f.label}</div>
              <div className="detail-value">{f.value === "" || f.value === null || f.value === undefined ? "—" : f.value}</div>
            </div>
          ))}
        </div>
        <div className="modal-form-actions">
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
