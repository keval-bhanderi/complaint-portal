const BASE = '/api';

const getToken = () => localStorage.getItem('token');

const api = async (method, path, body = null, isFormData = false) => {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const Auth = {
  register: (body) => api('POST', '/auth/register', body),
  login: (body) => api('POST', '/auth/login', body),
  me: () => api('GET', '/auth/me'),
};

const Complaints = {
  create: (form) => api('POST', '/complaints', form, true),
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api('GET', `/complaints?${q}`);
  },
  map: () => api('GET', '/complaints/map'),
  get: (id) => api('GET', `/complaints/${id}`),
  updateStatus: (id, body) => api('PATCH', `/complaints/${id}/status`, body),
  upvote: (id) => api('PATCH', `/complaints/${id}/upvote`),
  delete: (id) => api('DELETE', `/complaints/${id}`),
};

const Dashboard = {
  stats: () => api('GET', '/dashboard/stats'),
  mapData: () => api('GET', '/dashboard/map-data'),
};

const Users = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api('GET', `/users?${q}`);
  },
  updateRole: (id, role) => api('PATCH', `/users/${id}/role`, { role }),
  toggle: (id) => api('PATCH', `/users/${id}/toggle`),
};
