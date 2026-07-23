import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell, ChevronRight, LogOut, Moon, Plus, Search, Settings, Sun, User,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { applyTheme, getInitialTheme } from "../theme";

const ROUTE_TITLES = {
  "/": ["Dashboard"],
  "/products-list": ["Products"],
  "/pos": ["Sales", "Point of sale"],
  "/sales": ["Sales", "Sales history"],
  "/reports": ["Reports"],
  "/stock": ["Inventory", "Stock"],
  "/stock/intake": ["Inventory", "Stock intake"],
  "/products": ["Inventory", "Products & SKUs"],
  "/categories": ["Inventory", "Categories"],
  "/brands": ["Inventory", "Brands"],
  "/suppliers": ["Inventory", "Suppliers"],
  "/branches": ["User management", "Branches"],
  "/employees": ["User management", "Employees"],
};

const QUICK_ADD = [
  { label: "New sale", to: "/pos", permission: "can_use_pos" },
  { label: "New product", to: "/products-list" },
  { label: "Stock intake", to: "/stock/intake" },
  { label: "New brand", to: "/products-list" },
];

function initials(user) {
  const source = user.full_name || user.email || "?";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
}

function useClickOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

export default function TopBar() {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getInitialTheme());
  const [openMenu, setOpenMenu] = useState(null); // "add" | "profile" | null

  useEffect(() => { applyTheme(theme); }, [theme]);

  const crumbs = ROUTE_TITLES[location.pathname] || ["Nexora"];
  const pageTitle = crumbs[crumbs.length - 1];

  const menuRef = useClickOutside(() => setOpenMenu(null));

  return (
    <div className="topbar">
      <div className="topbar-crumbs">
        <div className="breadcrumbs">
          {crumbs.slice(0, -1).map((c) => (
            <span key={c} style={{ display: "flex", alignItems: "center", gap: ".35rem" }}>
              {c}<ChevronRight size={12} className="sep" />
            </span>
          ))}
        </div>
        <div className="topbar-title">{pageTitle}</div>
      </div>

      <div className="topbar-search">
        <Search size={16} />
        <input placeholder="Search products, sales, stock…" />
        <span className="kbd">⌘K</span>
      </div>

      <div className="topbar-actions" ref={menuRef}>
        <div className="menu-wrap">
          <button
            className="quick-add-btn"
            onClick={() => setOpenMenu(openMenu === "add" ? null : "add")}
          >
            <Plus size={15} /> Quick add
          </button>
          {openMenu === "add" && (
            <div className="menu-popover">
              <div className="menu-label">Create new</div>
              {QUICK_ADD.filter((i) => !i.permission || can(i.permission)).map((item) => (
                <button
                  key={item.label}
                  className="menu-item"
                  onClick={() => { navigate(item.to); setOpenMenu(null); }}
                >
                  <Plus size={14} /> {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="icon-action" title="Notifications" aria-label="Notifications">
          <Bell size={17} />
          <span className="dot" />
        </button>

        <div className="theme-toggle" title="Toggle theme">
          <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} aria-label="Light theme">
            <Sun size={14} />
          </button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} aria-label="Dark theme">
            <Moon size={14} />
          </button>
        </div>

        <div className="menu-wrap">
          <button
            className="icon-action"
            style={{ width: "auto", padding: "0 .3rem" }}
            onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
          >
            <span className="profile-avatar" style={{ width: 28, height: 28, fontSize: ".72rem" }}>
              {initials(user)}
            </span>
          </button>
          {openMenu === "profile" && (
            <div className="menu-popover">
              <div className="menu-user">
                <div className="name">{user.full_name || user.email}</div>
                <div className="email">{user.email}</div>
              </div>
              <div className="menu-divider" />
              <button className="menu-item"><User size={14} /> Account</button>
              <button className="menu-item"><Settings size={14} /> Preferences</button>
              <div className="menu-divider" />
              <button className="menu-item danger" onClick={logout}>
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
