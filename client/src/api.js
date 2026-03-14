import axios from "axios";

// Get API URL — prioritize local for dev unless explicitly overridden
const isDev = import.meta.env.MODE === 'development';
const baseURL = (
    import.meta.env.VITE_API_URL || (isDev ? "http://localhost:5005" : "https://kagzso-backend.onrender.com")
).replace(/\/+$/, "");

// Create axios instance
const api = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor (Token)
api.interceptors.request.use(
    (config) => {
        try {
            const user = JSON.parse(sessionStorage.getItem("user"));

            // Add JWT token
            if (user?.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
            }
        } catch (error) {
            console.error("LocalStorage error:", error);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
export { baseURL };