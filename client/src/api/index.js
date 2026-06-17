import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

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

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  changePassword: (data) => api.post('/auth/change-password', data)
};

export const customerApi = {
  list: (params) => api.get('/customers', { params }),
  all: () => api.get('/customers/all'),
  detail: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
};

export const contractApi = {
  list: (params) => api.get('/contracts', { params }),
  all: () => api.get('/contracts/all'),
  detail: (id) => api.get(`/contracts/${id}`),
  create: (data) => api.post('/contracts', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  delete: (id) => api.delete(`/contracts/${id}`)
};

export const orderApi = {
  list: (params) => api.get('/orders', { params }),
  all: () => api.get('/orders/all'),
  detail: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`)
};

export const invoiceApi = {
  list: (params) => api.get('/invoices', { params }),
  detail: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  sendReminder: (id, data) => api.post(`/invoices/${id}/send-reminder`, data)
};

export const paymentApi = {
  list: (params) => api.get('/payments', { params }),
  detail: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`)
};

export const receivableApi = {
  summary: () => api.get('/receivables/summary'),
  ageingAnalysis: (params) => api.get('/receivables/ageing-analysis', { params }),
  paymentSpeed: (params) => api.get('/receivables/payment-speed', { params }),
  monthlyReport: (params) => api.get('/receivables/monthly-report', { params }),
  customerStatement: (id, params) => api.get(`/receivables/customer-statement/${id}`, { params })
};

export const exportApi = {
  ageingAnalysis: (params) => {
    const query = new URLSearchParams(params).toString();
    window.open(`/api/export/ageing-analysis?${query}`, '_blank');
  },
  paymentSpeed: (params) => {
    const query = new URLSearchParams(params).toString();
    window.open(`/api/export/payment-speed?${query}`, '_blank');
  },
  monthlyReport: (params) => {
    const query = new URLSearchParams(params).toString();
    window.open(`/api/export/monthly-report?${query}`, '_blank');
  },
  customerStatement: (id, params) => {
    const query = new URLSearchParams(params).toString();
    window.open(`/api/export/customer-statement/${id}?${query}`, '_blank');
  }
};

export default api;
