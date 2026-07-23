export function LogoMark({ size = 30 }) {
  return (
    <div className="logo-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 13.5 L9.5 8 L14 12.5 L20 5"
          stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        />
        <path
          d="M15 5H20V10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function Logo({ workspace, collapsed }) {
  if (collapsed) return <LogoMark />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".6rem", minWidth: 0 }}>
      <LogoMark />
      <div className="logo-wordmark">
        <span>Nexora</span>
        {workspace && <span className="workspace" title={workspace}>{workspace}</span>}
      </div>
    </div>
  );
}
