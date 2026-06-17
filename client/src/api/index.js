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
  (response) => {
    if (response.config.responseType === 'blob') {
      return response;
    }
    return response.data;
  },
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

const downloadFile = (response, defaultFilename) => {
  const disposition = response.headers['content-disposition'];
  let filename = defaultFilename;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1]);
    }
  }
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const exportApi = {
  ageingAnalysis: async (params) => {
    const response = await api.get('/export/ageing-analysis', {
      params,
      responseType: 'blob'
    });
    downloadFile(response, '应收账款账龄分析表.xlsx');
  },
  paymentSpeed: async (params) => {
    const response = await api.get('/export/payment-speed', {
      params,
      responseType: 'blob'
    });
    downloadFile(response, '回款速度分析表.xlsx');
  },
  monthlyReport: async (params) => {
    const response = await api.get('/export/monthly-report', {
      params,
      responseType: 'blob'
    });
    downloadFile(response, '月度报告.xlsx');
  },
  customerStatement: async (id, params) => {
    const response = await api.get(`/export/customer-statement/${id}`, {
      params,
      responseType: 'blob'
    });
    downloadFile(response, '客户对账单.xlsx');
  }
};

export default api;
