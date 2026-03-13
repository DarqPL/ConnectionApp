import axios from "axios";

const api = axios.create({
    baseURL:
        import.meta.env.MODE === "development"
            ? "http://localhost:8080/api"
            : "/api",
    withCredentials: true,
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
    (config) => {
        const accessToken = localStorage.getItem("accessToken");
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and try refresh token
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status === 401 &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem("refreshToken");

            if (refreshToken) {
                try {
                    const res = await axios.post(
                        `${api.defaults.baseURL}/auth/refresh`,
                        { refreshToken }
                    );
                    const newAccessToken = res.data.accessToken;
                    localStorage.setItem("accessToken", newAccessToken);
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                } catch {
                    // Refresh failed, clear tokens
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    window.location.href = "/signin";
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;
