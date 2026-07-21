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

export function errorText(error) {
  const data = error.response?.data;
  if (!data) return "Network error — is the backend running?";
  if (typeof data === "string") return data;
  if (data.detail) return String(data.detail);
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(" ") : value}`)
    .join(" | ");
}
