import axios from "axios";

// Same subdomain as the page, backend on port 8000.
// alpha.lvh.me:3000 (React)  ->  alpha.lvh.me:8000 (Django)
const API_BASE = `http://${window.location.hostname}:8000/api`;

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes("/auth/login/")) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function errorTitle(message) {
  return /already exists/i.test(message || "") ? "Already exists" : "Something went wrong";
}

export function errorText(error) {
  const data = error.response?.data;
  if (!data) return "Network error — is the backend running?";
  if (typeof data === "string") return data;

  // Standardized backend envelope: { success, error_code, message, errors }.
  if (data.errors && typeof data.errors === "object") {
    const entries = Object.entries(data.errors);
    if (entries.length === 1) {
      const [, value] = entries[0];
      return Array.isArray(value) ? value.join(" ") : String(value);
    }
    if (entries.length > 1) {
      return entries
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(" ") : value}`)
        .join(" | ");
    }
    if (data.message) return data.message;
  }

  // Fallback for any response not yet using the standardized envelope.
  if (data.detail) return String(data.detail);
  const entries = Object.entries(data);
  if (entries.length === 1) {
    const [, value] = entries[0];
    return Array.isArray(value) ? value.join(" ") : String(value);
  }
  return entries
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(" ") : value}`)
    .join(" | ");
}
