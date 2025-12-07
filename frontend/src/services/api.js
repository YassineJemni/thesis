// src/services/api.js
import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (userData) => api.post('/api/auth/register', userData),
  login: (credentials) => api.post('/api/auth/login', credentials, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }),
  getCurrentUser: () => api.get('/api/auth/me'),
};

// Project APIs
export const projectAPI = {
  getAll: () => api.get('/api/projects'),
  getById: (id) => api.get(`/api/projects/${id}`),
  create: (projectData) => api.post('/api/projects', projectData),
  delete: (id) => api.delete(`/api/projects/${id}`),
  getDAG: (id) => api.get(`/api/projects/${id}/dag`),
  allocate: (id) => api.post(`/api/projects/${id}/allocate`),
  getSchedule: (id) => api.get(`/api/projects/${id}/schedule`),
};

// Task APIs
export const taskAPI = {
  getByProject: (projectId) => api.get(`/api/projects/${projectId}/tasks`),
  getById: (id) => api.get(`/api/tasks/${id}`),
  create: (projectId, taskData) => api.post(`/api/projects/${projectId}/tasks`, taskData),
  update: (id, taskData) => api.put(`/api/tasks/${id}`, taskData),
  delete: (id) => api.delete(`/api/tasks/${id}`),
  createDependency: (dependencyData) => api.post('/api/tasks/dependencies', dependencyData),
};

// Resource APIs
export const resourceAPI = {
  getAll: () => api.get('/api/resources'),
  getById: (id) => api.get(`/api/resources/${id}`),
  create: (resourceData) => api.post('/api/resources', resourceData),
  updateAvailability: (id, available) => api.put(`/api/resources/${id}/availability`, null, {
    params: { available }
  }),
};

export default api;