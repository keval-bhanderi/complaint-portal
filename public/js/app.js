// ─── State ───────────────────────────────────────────────
let currentUser = null;
let submitMap = null;
let mainMap = null;
let submitMarker = null;
let currentPage = 1;

// ─── Bootstrap ───────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const { user } = await Auth.me();
      setUser(user);
    } catch {
      localStorage.removeItem('token');
    }
  }
  showPage('home');
  loadPublicStats();
});

// ─── Mobile Menu ─────────────────────────────────────────
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const btn = document.getElementById('hamburger');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
}

function mobileNav(page) {
  toggleMobileMenu();
  showPage(page);
}

// ─── Toast Notification ───────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ─── Auth ─────────────────────────────────────────────────
function setUser(user) {
  currentUser = user;
  document.getElementById('auth-buttons').classList.add('hidden');
  document.getElementById('user-menu').classList.remove('hidden');
  document.getElementById('user-name-display').textContent = `Hi, ${user.name.split(' ')[0]} 👋`;
  if (user.role === 'authority' || user.role === 'admin') {
    document.getElementById('nav-dash').classList.remove('hidden');
    document.getElementById('mob-dash').classList.remove('hidden');
  }
  if (user.role === 'admin') {
    document.getElementById('nav-admin').classList.remove('hidden');
    document.getElementById('mob-admin').classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  document.getElementById('auth-buttons').classList.remove('hidden');
  document.getElementById('user-menu').classList.add('hidden');
  document.getElementById('nav-dash').classList.add('hidden');
  document.getElementById('nav-admin').classList.add('hidden');
  showToast('Logged out successfully', 'info');
  showPage('home');
}

async function login() {
  clearAlert('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    showAlert('login-error', 'Please enter email and password.');
    return;
  }
  try {
    const { token, user } = await Auth.login({ email, password });
    localStorage.setItem('token', token);
    setUser(user);
    showToast(`Welcome back, ${user.name.split(' ')[0]}!`);
    showPage('my-complaints');
  } catch (err) {
    showAlert('login-error', err.message);
  }
}

async function register() {
  clearAlert('register-error');
  const body = {
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    phone: document.getElementById('reg-phone').value.trim(),
    area: document.getElementById('reg-area').value.trim(),
  };
  if (!body.name || !body.email || !body.password) {
    showAlert('register-error', 'Name, email and password are required.');
    return;
  }
  try {
    const { token, user } = await Auth.register(body);
    localStorage.setItem('token', token);
    setUser(user);
    showToast(`Welcome to CivicAlert, ${user.name.split(' ')[0]}!`);
    showPage('my-complaints');
  } catch (err) {
    showAlert('register-error', err.message);
  }
}

// ─── Page Router ─────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${name}`);
  if (!target) return;

  if (!['login', 'register', 'home', 'map', 'emergency', 'about'].includes(name) && !currentUser) {
    showToast('Please login to continue', 'info');
    showPage('login');
    return;
  }

  target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'my-complaints') { currentPage = 1; loadMyComplaints(); }
  if (name === 'map') initMainMap();
  if (name === 'submit') setTimeout(initSubmitMap, 100);
  if (name === 'dashboard') loadDashboard();
  if (name === 'admin') loadUsers();
  if (name === 'emergency') renderEmergencyPage();
}

function submitWithCategory(cat) {
  if (!currentUser) {
    showToast('Please login to submit a complaint', 'info');
    showPage('login');
    return;
  }
  showPage('submit');
  setTimeout(() => { document.getElementById('c-category').value = cat; }, 200);
}

// ─── Public Stats ─────────────────────────────────────────
async function loadPublicStats() {
  try {
    const res = await fetch('/api/dashboard/public-stats');
    const data = await res.json();
    if (data.success) {
      animateCount('stat-total', data.stats.total);
      animateCount('stat-resolved', data.stats.resolved);
      animateCount('stat-open', data.stats.open);
    }
  } catch (err) {
    console.error('Public stats error:', err);
  }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let start = 0;
  const duration = 1000;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { el.textContent = target; clearInterval(timer); }
    else { el.textContent = Math.floor(start); }
  }, 16);
}

// ─── Submit Map (Leaflet) ─────────────────────────────────
function initSubmitMap() {
  if (submitMap) { submitMap.invalidateSize(); return; }
  submitMap = L.map('submit-map').setView([22.557, 72.951], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(submitMap);
  submitMap.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    placeSubmitMarker(lat, lng);
    document.getElementById('c-lat').value = lat;
    document.getElementById('c-lng').value = lng;
    await reverseGeocode(lat, lng);
  });
}

function placeSubmitMarker(lat, lng) {
  if (submitMarker) submitMap.removeLayer(submitMarker);
  submitMarker = L.marker([lat, lng]).addTo(submitMap);
  submitMap.setView([lat, lng], 15);
}

async function searchAddress() {
  const address = document.getElementById('c-address').value.trim();
  if (!address) { showToast('Please enter an address to search', 'error'); return; }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (!data.length) { showToast('Address not found. Try a more specific address.', 'error'); return; }
    const { lat, lon, display_name } = data[0];
    placeSubmitMarker(parseFloat(lat), parseFloat(lon));
    document.getElementById('c-lat').value = lat;
    document.getElementById('c-lng').value = lon;
    document.getElementById('c-address').value = display_name;
  } catch (err) {
    showToast('Search failed. Click on the map to pin location.', 'error');
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data.display_name) document.getElementById('c-address').value = data.display_name;
  } catch (err) { console.error('Reverse geocode failed:', err); }
}

// ─── Submit Complaint ─────────────────────────────────────
async function submitComplaint() {
  clearAlert('submit-error');
  clearAlert('submit-success');
  const title = document.getElementById('c-title').value.trim();
  const category = document.getElementById('c-category').value;
  const description = document.getElementById('c-description').value.trim();
  const address = document.getElementById('c-address').value.trim();
  const lat = document.getElementById('c-lat').value;
  const lng = document.getElementById('c-lng').value;
  const priority = document.getElementById('c-priority').value;

  if (!title || !category || !description || !address || !lat || !lng) {
    showAlert('submit-error', 'Please fill all required fields and pin the location on the map.');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('category', category);
  formData.append('description', description);
  formData.append('address', address);
  formData.append('lat', lat);
  formData.append('lng', lng);
  formData.append('priority', priority);

  const photos = document.getElementById('c-photos').files;
  for (let i = 0; i < Math.min(photos.length, 3); i++) {
    formData.append('photos', photos[i]);
  }

  try {
    await Complaints.create(formData);
    showAlert('submit-success', '✅ Complaint submitted successfully!');
    showToast('Complaint submitted successfully!');
    document.getElementById('c-title').value = '';
    document.getElementById('c-description').value = '';
    document.getElementById('c-address').value = '';
    document.getElementById('c-lat').value = '';
    document.getElementById('c-lng').value = '';
    if (submitMarker) { submitMap.removeLayer(submitMarker); submitMarker = null; }
    loadPublicStats();
    setTimeout(() => {
      if (currentUser?.role === 'admin' || currentUser?.role === 'authority') {
        showPage('dashboard');
      } else {
        showPage('my-complaints');
      }
    }, 1500);
  } catch (err) {
    showAlert('submit-error', err.message);
  }
}

// ─── Main Map (Leaflet) ───────────────────────────────────
const statusColors = {
  open: '#EF9F27', 'in-progress': '#378ADD', resolved: '#639922', rejected: '#E24B4A',
};

async function initMainMap() {
  const mapEl = document.getElementById('main-map');
  if (!mapEl) return;
  if (!mainMap) {
    mainMap = L.map('main-map').setView([22.557, 72.951], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mainMap);
  } else {
    mainMap.invalidateSize();
  }
  try {
    const role = currentUser?.role;
    let complaints;
    if (role === 'authority' || role === 'admin') {
      const data = await Dashboard.mapData();
      complaints = data.complaints;
    } else {
      const data = await Complaints.map();
      complaints = data.complaints;
    }
    complaints.forEach(c => {
      if (!c.location?.lat) return;
      const color = statusColors[c.status] || '#888';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const marker = L.marker([c.location.lat, c.location.lng], { icon }).addTo(mainMap);
      marker.bindPopup(`
        <div style="min-width:180px;">
          <strong>${c.title}</strong><br>
          <span style="font-size:12px;">${c.category} · <b>${c.status}</b></span><br>
          <span style="font-size:12px;color:#666;">${c.location.address}</span>
        </div>
      `);
    });
  } catch (err) { console.error('Map error:', err); }
}

// ─── My Complaints ────────────────────────────────────────
async function loadMyComplaints() {
  const list = document.getElementById('complaints-list');
  list.innerHTML = '<div class="loading">⏳ Loading complaints...</div>';
  const params = { page: currentPage, limit: 9 };
  const status = document.getElementById('filter-status')?.value;
  const category = document.getElementById('filter-category')?.value;
  const search = document.getElementById('filter-search')?.value;
  if (status) params.status = status;
  if (category) params.category = category;
  if (search) params.search = search;
  try {
    const { complaints, pages } = await Complaints.list(params);
    if (!complaints.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div style="font-size:48px;margin-bottom:16px;">📭</div>
          <h3>No complaints found</h3>
          <p>Submit your first complaint to get started.</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="showPage('submit')">+ Submit Complaint</button>
        </div>`;
      return;
    }
    list.innerHTML = complaints.map(renderComplaintCard).join('');
    renderPagination(pages);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><h3>Error loading complaints</h3><p>${err.message}</p></div>`;
  }
}

function renderComplaintCard(c) {
  return `
    <div class="complaint-card" onclick="viewComplaint('${c._id}')">
      <div class="card-header">
        <div class="card-title">${c.title}</div>
        <span class="badge badge-${c.status}">${c.status}</span>
      </div>
      <div class="card-meta">
        <span class="cat-badge">${c.category}</span>
        &nbsp;·&nbsp; ${new Date(c.createdAt).toLocaleDateString('en-IN')}
        &nbsp;·&nbsp; 👍 ${c.upvoteCount || c.upvotes?.length || 0}
      </div>
      <div class="card-location">📍 ${c.location?.address?.substring(0, 60) || ''}...</div>
      <div class="card-footer">
        <span class="badge badge-${c.priority}">${c.priority} priority</span>
        ${currentUser?.role === 'authority' || currentUser?.role === 'admin'
          ? `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); openStatusModal('${c._id}', '${c.status}')">Update status</button>`
          : ''}
      </div>
    </div>`;
}

function renderPagination(pages) {
  const pag = document.getElementById('pagination');
  if (!pag || pages <= 1) { if (pag) pag.innerHTML = ''; return; }
  pag.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
    .map(p => `<button class="${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`)
    .join('');
}

function goToPage(p) { currentPage = p; loadMyComplaints(); }

// ─── Complaint Detail ─────────────────────────────────────
async function viewComplaint(id) {
  showPage('detail');
  const container = document.getElementById('complaint-detail');
  container.innerHTML = '<div class="loading">⏳ Loading...</div>';
  try {
    const { complaint: c } = await Complaints.get(id);
    const canUpdate = currentUser?.role === 'authority' || currentUser?.role === 'admin';
    const isOwner = currentUser?._id === c.submittedBy?._id;
    container.innerHTML = `
      <div class="detail-card">
        <div class="detail-title">${c.title}</div>
        <div class="detail-meta">
          <span class="badge badge-${c.status}">${c.status}</span>
          <span class="cat-badge">${c.category}</span>
          <span class="badge badge-${c.priority}">${c.priority} priority</span>
        </div>
        <div class="detail-description">${c.description}</div>
        <div style="margin-top:14px;font-size:13px;color:var(--text-muted);line-height:1.8;">
          📍 ${c.location.address}<br>
          🕒 Submitted on ${new Date(c.createdAt).toLocaleString('en-IN')}<br>
          👤 By ${c.submittedBy?.name || 'Unknown'}
          ${c.assignedTo ? `<br>🔧 Assigned to: ${c.assignedTo.name}` : ''}
        </div>
        ${c.photos?.length ? `<div class="detail-photos">${c.photos.map(p => `<img class="detail-photo" src="${p.url}" alt="photo" onclick="window.open('${p.url}')" />`).join('')}</div>` : ''}
        <div class="detail-actions">
          ${canUpdate ? `<button class="btn btn-primary btn-sm" onclick="openStatusModal('${c._id}', '${c.status}')">✏️ Update Status</button>` : ''}
          ${isOwner && c.status === 'open' ? `<button class="btn btn-danger btn-sm" onclick="deleteComplaint('${c._id}')">🗑️ Delete</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="upvoteComplaint('${c._id}')">👍 Upvote (${c.upvoteCount || 0})</button>
        </div>
      </div>
      <div class="detail-card">
        <h3>📋 Status Timeline</h3>
        <ul class="timeline">
          ${c.timeline.map(t => `
            <li class="timeline-item">
              <div class="timeline-status"><span class="badge badge-${t.status}">${t.status}</span></div>
              ${t.note ? `<div class="timeline-note">${t.note}</div>` : ''}
              <div class="timeline-time">${new Date(t.createdAt).toLocaleString('en-IN')}${t.changedBy ? ` · ${t.changedBy.name}` : ''}</div>
            </li>`).join('')}
        </ul>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

async function deleteComplaint(id) {
  if (!confirm('Are you sure you want to delete this complaint?')) return;
  try {
    await Complaints.delete(id);
    showToast('Complaint deleted successfully');
    showPage('my-complaints');
  } catch (err) { showToast(err.message, 'error'); }
}

async function upvoteComplaint(id) {
  try {
    await Complaints.upvote(id);
    viewComplaint(id);
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── Status Modal ─────────────────────────────────────────
function openStatusModal(id, currentStatus) {
  document.getElementById('modal-complaint-id').value = id;
  document.getElementById('modal-status').value = currentStatus;
  document.getElementById('modal-note').value = '';
  document.getElementById('status-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('status-modal').classList.add('hidden');
}

async function submitStatusUpdate() {
  const id = document.getElementById('modal-complaint-id').value;
  const status = document.getElementById('modal-status').value;
  const note = document.getElementById('modal-note').value.trim();
  try {
    await Complaints.updateStatus(id, { status, note });
    closeModal();
    showToast(`Status updated to "${status}" successfully`);
    if (!document.getElementById('page-dashboard').classList.contains('active')) {
      loadDashboard();
    } else {
      loadMyComplaints();
    }
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── Dashboard ────────────────────────────────────────────
async function loadDashboard() {
  document.getElementById('dash-stats').innerHTML = `
    <div class="dash-stat"><div class="dash-stat-label">Total</div><div class="dash-stat-num">...</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Open</div><div class="dash-stat-num">...</div></div>
    <div class="dash-stat"><div class="dash-stat-label">In Progress</div><div class="dash-stat-num">...</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Resolved</div><div class="dash-stat-num">...</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Avg. Resolution</div><div class="dash-stat-num">...</div></div>
  `;
  try {
    const { stats } = await Dashboard.stats();
    const { byStatus, total, avgResolutionHours } = stats;
    document.getElementById('dash-stats').innerHTML = `
      <div class="dash-stat"><div class="dash-stat-label">Total</div><div class="dash-stat-num">${total}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Open</div><div class="dash-stat-num" style="color:var(--amber)">${byStatus.open || 0}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">In Progress</div><div class="dash-stat-num" style="color:#378ADD">${byStatus['in-progress'] || 0}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Resolved</div><div class="dash-stat-num" style="color:var(--green)">${byStatus.resolved || 0}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Avg. Resolution</div><div class="dash-stat-num">${avgResolutionHours ? avgResolutionHours + 'h' : '—'}</div></div>
    `;
  } catch (err) {
    document.getElementById('dash-stats').innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
  }
  loadDashComplaints();
}

async function loadDashComplaints() {
  const list = document.getElementById('dash-complaints-list');
  list.innerHTML = '<div class="loading">⏳ Loading...</div>';
  const params = { limit: 20 };
  const status = document.getElementById('dash-filter-status')?.value;
  const category = document.getElementById('dash-filter-category')?.value;
  if (status) params.status = status;
  if (category) params.category = category;
  try {
    const { complaints } = await Complaints.list(params);
    list.innerHTML = complaints.length
      ? complaints.map(renderComplaintCard).join('')
      : '<div class="empty-state"><div style="font-size:48px">📭</div><h3>No complaints found</h3></div>';
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><h3>${err.message}</h3></div>`;
  }
}

// ─── Admin ────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">⏳ Loading users...</td></tr>';
  const role = document.getElementById('admin-role-filter')?.value;
  const params = {};
  if (role) params.role = role;
  try {
    const { users, total } = await Users.list(params);
    const countEl = document.getElementById('admin-user-count');
    if (countEl) countEl.textContent = `${total} total users`;
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>
          <select class="role-select" onchange="updateRole('${u._id}', this.value)">
            <option ${u.role === 'citizen' ? 'selected' : ''} value="citizen">citizen</option>
            <option ${u.role === 'authority' ? 'selected' : ''} value="authority">authority</option>
            <option ${u.role === 'admin' ? 'selected' : ''} value="admin">admin</option>
          </select>
        </td>
        <td>${u.area || '—'}</td>
        <td><span class="badge ${u.isActive ? 'badge-resolved' : 'badge-rejected'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
        <td><button class="btn btn-sm btn-outline" onclick="toggleUser('${u._id}')">${u.isActive ? 'Deactivate' : 'Activate'}</button></td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red;padding:16px;">${err.message}</td></tr>`;
  }
}

async function updateRole(id, role) {
  try {
    await Users.updateRole(id, role);
    showToast(`Role updated to "${role}"`);
  } catch (err) { showToast(err.message, 'error'); }
}

// ✅ New code
async function toggleUser(id) {
  try {
    const { message, user } = await Users.toggle(id);
    showToast(message);
    const btn = document.querySelector(`button[onclick="toggleUser('${id}')"]`);
    if (btn) {
      btn.textContent = user.isActive ? 'Deactivate' : 'Activate';
    }
    const row = btn?.closest('tr');
    if (row) {
      const statusCell = row.querySelector('.badge');
      if (statusCell) {
        statusCell.className = `badge ${user.isActive ? 'badge-resolved' : 'badge-rejected'}`;
        statusCell.textContent = user.isActive ? 'Active' : 'Inactive';
      }
    }
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── Emergency Numbers ────────────────────────────────────
const defaultEmergencyData = [
  { section: '🇮🇳 National Emergency', cards: [
    { name: 'Ambulance', dept: 'Medical Emergency', number: '108', color: 'red', icon: '🚑' },
    { name: 'Fire Brigade', dept: 'Fire Emergency', number: '101', color: 'red', icon: '🚒' },
    { name: 'Police', dept: 'Law & Order', number: '100', color: 'blue', icon: '👮' },
    { name: 'Women Helpline', dept: 'Women Safety', number: '1091', color: 'blue', icon: '👩' },
    { name: 'National Emergency', dept: 'All Emergencies', number: '112', color: 'green', icon: '🚨' },
    { name: 'Child Helpline', dept: 'Child Safety', number: '1098', color: 'green', icon: '🧒' },
    { name: 'COVID Helpline', dept: 'Health Ministry', number: '1075', color: 'amber', icon: '🏥' },
    { name: 'Mental Health', dept: 'iCall Helpline', number: '9152987821', color: 'amber', icon: '🧠' },
  ]},
  { section: '🏛️ Civic & Government', cards: [
    { name: 'Water Supply', dept: 'Municipal Corporation', number: '1800-233-456', color: 'purple', icon: '💧' },
    { name: 'Electricity Board', dept: 'Power Outage', number: '19123', color: 'purple', icon: '⚡' },
    { name: 'Garbage Collection', dept: 'Sanitation Dept', number: '1800-223-344', color: 'purple', icon: '🗑️' },
    { name: 'Road Helpline', dept: 'PWD Department', number: '1800-112-211', color: 'purple', icon: '🛣️' },
  ]},
  { section: '⚠️ Disaster Management', cards: [
    { name: 'Flood Control', dept: 'Disaster Management', number: '1070', color: 'red', icon: '🌊' },
    { name: 'NDRF Helpline', dept: 'National Disaster Response', number: '011-24363260', color: 'red', icon: '🏔️' },
  ]},
];

function getEmergencyData() {
  const extra = JSON.parse(localStorage.getItem('extraEmergency') || '[]');
  const data = JSON.parse(JSON.stringify(defaultEmergencyData));
  if (extra.length) data.push({ section: '➕ Custom Numbers', cards: extra });
  return data;
}

function renderEmergencyPage() {
  const data = getEmergencyData();
  const grid = document.getElementById('emergency-grid');
  grid.innerHTML = data.map(section => `
    <div class="e-section">
      <h3 class="e-section-title">${section.section}</h3>
      <div class="e-cards">
        ${section.cards.map(card => `
          <div class="e-card ${card.color}" data-name="${card.name.toLowerCase()}" data-number="${card.number}">
            <div class="e-icon">${card.icon}</div>
            <div class="e-info">
              <div class="e-name">${card.name}</div>
              <div class="e-dept">${card.dept}</div>
              <a href="tel:${card.number.replace(/-/g, '')}" class="e-number">${card.number}</a>
            </div>
            <a href="tel:${card.number.replace(/-/g, '')}" class="call-btn">📞 Call</a>
          </div>`).join('')}
      </div>
    </div>`).join('');

  if (currentUser?.role === 'admin') {
    document.getElementById('add-emergency-btn').classList.remove('hidden');
  }
}

function filterEmergency() {
  const query = document.getElementById('emergency-search').value.toLowerCase();
  document.querySelectorAll('.e-card').forEach(card => {
    const name = card.dataset.name || '';
    const number = card.dataset.number || '';
    card.classList.toggle('hidden-card', !name.includes(query) && !number.includes(query));
  });
}

function showAddEmergencyModal() {
  document.getElementById('emergency-modal').classList.remove('hidden');
}

function closeEmergencyModal() {
  document.getElementById('emergency-modal').classList.add('hidden');
}

function addEmergencyNumber() {
  const name = document.getElementById('em-name').value.trim();
  const dept = document.getElementById('em-dept').value.trim();
  const number = document.getElementById('em-number').value.trim();
  const color = document.getElementById('em-category').value;
  const icon = document.getElementById('em-icon').value.trim() || '📞';
  if (!name || !number) { showToast('Name and number are required!', 'error'); return; }
  const extra = JSON.parse(localStorage.getItem('extraEmergency') || '[]');
  extra.push({ name, dept, number, color, icon });
  localStorage.setItem('extraEmergency', JSON.stringify(extra));
  closeEmergencyModal();
  renderEmergencyPage();
  showToast('Emergency number added!');
  document.getElementById('em-name').value = '';
  document.getElementById('em-dept').value = '';
  document.getElementById('em-number').value = '';
  document.getElementById('em-icon').value = '';
}

// ─── Helpers ──────────────────────────────────────────────
function showAlert(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearAlert(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}