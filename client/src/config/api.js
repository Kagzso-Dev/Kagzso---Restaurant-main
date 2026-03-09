// Re-export the runtime API base URL from the central api.js module.
// This keeps all URL configuration in one place (VITE_API_URL env var).
export { baseURL as default } from '../api';
