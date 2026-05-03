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

// ─── Auth ─────────────────────────────────────────────────
function setUser(user) {
  currentUser = user;
  document.getElementById('auth-buttons').classList.add('hidden');
  document.getElementById('user-menu').classList.remove('hidden');
  document.getElementById('user-name-display').textContent = `Hi, ${user.name.split(' ')[0]}`;
  if (user.role === 'authority' || user.role === 'admin') {
    document.getElementById('nav-dash').classList.remove('hidden');
  }
  if (user.role === 'admin') {
    document.getElementById('nav-admin').classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  document.getElementById('auth-buttons').classList.remove('hidden');
  document.getElementById('user-menu').classList.add('hidden');
  document.getElementById('nav-dash').classList.add('hidden');
  document.getElementById('nav-admin').classList.add('hidden');
  showPage('home');
}

async function login() {
  clearAlert('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const { token, user } = await Auth.login({ email, password });
    localStorage.setItem('token', token);
    setUser(user);
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
  try {
    const { token, user } = await Auth.register(body);
    localStorage.setItem('token', token);
    setUser(user);
    showPage('my-complaints');
  } catch (err) {
    showAlert('register-error', err.message);
  }
}

// ─── Page Router ─────────────────────────────────────────
function showPage(name) {
  // Remove active from all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const target = document.getElementById(`page-${name}`);
  if (!target) return;

  if (!['login', 'register', 'home', 'map', 'emergency'].includes(name) && !currentUser) {
    showPage('login');
    return;
  }

  target.classList.add('active');

  if (name === 'my-complaints') loadMyComplaints();
  if (name === 'map') initMainMap();
  if (name === 'submit') setTimeout(initSubmitMap, 100);
  if (name === 'dashboard') loadDashboard();
  if (name === 'admin') loadUsers();
  if (name === 'emergency') renderEmergencyPage();
}

function submitWithCategory(cat) {
  if (!currentUser) { showPage('login'); return; }
  showPage('submit');
  setTimeout(() => { document.getElementById('c-category').value = cat; }, 200);
}

// ─── Public stats on home ─────────────────────────────────
async function loadPublicStats() {
  try {
    const res = await fetch('/api/dashboard/public-stats');
    const data = await res.json();
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.total;
      document.getElementById('stat-resolved').textContent = data.stats.resolved;
      document.getElementById('stat-open').textContent = data.stats.open;
    }
  } catch (err) {
    console.error('Public stats error:', err);
  }
}

// ─── Submit Map (Leaflet + OpenStreetMap) ─────────────────
function initSubmitMap() {
  if (submitMap) {
    submitMap.invalidateSize();
    return;
  }

  submitMap = L.map('submit-map').setView([22.557, 72.951], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

// Search address using Nominatim (free, no API key needed)
async function searchAddress() {
  const address = document.getElementById('c-address').value.trim();
  if (!address) { alert('Please enter an address to search.'); return; }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();

    if (!data.length) {
      alert('Address not found. Try something like "MG Road, Anand, Gujarat".');
      return;
    }

    const { lat, lon, display_name } = data[0];
    placeSubmitMarker(parseFloat(lat), parseFloat(lon));
    document.getElementById('c-lat').value = lat;
    document.getElementById('c-lng').value = lon;
    document.getElementById('c-address').value = display_name;
  } catch (err) {
    alert('Search failed. Please click directly on the map to pin your location.');
  }
}

// Reverse geocode using Nominatim
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data.display_name) {
      document.getElementById('c-address').value = data.display_name;
    }
  } catch (err) {
    console.error('Reverse geocode failed:', err);
  }
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
    showAlert('submit-success', 'Complaint submitted! Track it in "My Complaints".');
    document.getElementById('c-title').value = '';
    document.getElementById('c-description').value = '';
    document.getElementById('c-address').value = '';
    document.getElementById('c-lat').value = '';
    document.getElementById('c-lng').value = '';
    if (submitMarker) { submitMap.removeLayer(submitMarker); submitMarker = null; }

    // Auto redirect to dashboard after 1.5 seconds if admin/authority
    if (currentUser?.role === 'admin' || currentUser?.role === 'authority') {
      setTimeout(() => showPage('dashboard'), 1500);
    } else {
      setTimeout(() => showPage('my-complaints'), 1500);
    }
  } catch (err) {
    showAlert('submit-error', err.message);
  }
}

// ─── Main Map (Leaflet) ───────────────────────────────────
const statusColors = {
  open: '#EF9F27',
  'in-progress': '#378ADD',
  resolved: '#639922',
  rejected: '#E24B4A',
};

async function initMainMap() {
  const mapEl = document.getElementById('main-map');
  if (!mapEl) return;

  if (!mainMap) {
    mainMap = L.map('main-map').setView([22.557, 72.951], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
        iconSize: [14, 14],
        iconAnchor: [7, 7],
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
  } catch (err) {
    console.error('Map data error:', err);
  }
}

// ─── My Complaints ────────────────────────────────────────
async function loadMyComplaints() {
  const list = document.getElementById('complaints-list');
  list.innerHTML = '<div class="loading">Loading...</div>';

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
      list.innerHTML = `<div class="empty-state"><h3>No complaints found</h3><p>Submit a new complaint to get started.</p></div>`;
      return;
    }
    list.innerHTML = complaints.map(renderComplaintCard).join('');
    renderPagination(pages);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
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
        &nbsp;·&nbsp; ${new Date(c.createdAt).toLocaleDateString()}
        &nbsp;·&nbsp; ${c.upvoteCount || c.upvotes?.length || 0} upvotes
      </div>
      <div class="card-location">📍 ${c.location?.address || ''}</div>
      <div class="card-footer">
        <span class="badge badge-${c.priority}">${c.priority} priority</span>
        ${currentUser?.role === 'authority' || currentUser?.role === 'admin'
          ? `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); openStatusModal('${c._id}', '${c.status}')">Update status</button>`
          : ''}
      </div>
    </div>
  `;
}

function renderPagination(pages) {
  const pag = document.getElementById('pagination');
  if (!pag || pages <= 1) { if (pag) pag.innerHTML = ''; return; }
  pag.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
    .map(p => `<button class="${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`)
    .join('');
}

function goToPage(p) {
  currentPage = p;
  loadMyComplaints();
}

// ─── Complaint Detail ─────────────────────────────────────
async function viewComplaint(id) {
  showPage('detail');
  const container = document.getElementById('complaint-detail');
  container.innerHTML = '<div class="loading">Loading...</div>';

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
          <span class="badge badge-${c.priority}">${c.priority}</span>
        </div>
        <div class="detail-description">${c.description}</div>
        <div style="margin-top:12px;font-size:13px;color:var(--text-muted);">
          📍 ${c.location.address}<br>
          🕒 Submitted ${new Date(c.createdAt).toLocaleString()}<br>
          👤 ${c.submittedBy?.name || 'Unknown'}
          ${c.assignedTo ? `<br>🔧 Assigned to: ${c.assignedTo.name}` : ''}
        </div>
        ${c.photos?.length ? `<div class="detail-photos">${c.photos.map(p => `<img class="detail-photo" src="${p.url}" alt="photo" />`).join('')}</div>` : ''}
        <div class="detail-actions">
          ${canUpdate ? `<button class="btn btn-primary btn-sm" onclick="openStatusModal('${c._id}', '${c.status}')">Update Status</button>` : ''}
          ${isOwner && c.status === 'open' ? `<button class="btn btn-danger btn-sm" onclick="deleteComplaint('${c._id}')">Delete</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="upvoteComplaint('${c._id}')">👍 Upvote (${c.upvoteCount || 0})</button>
        </div>
      </div>
      <div class="detail-card">
        <h3>Status Timeline</h3>
        <ul class="timeline">
          ${c.timeline.map(t => `
            <li class="timeline-item">
              <div class="timeline-status"><span class="badge badge-${t.status}">${t.status}</span></div>
              ${t.note ? `<div class="timeline-note">${t.note}</div>` : ''}
              <div class="timeline-time">${new Date(t.createdAt).toLocaleString()}${t.changedBy ? ` · ${t.changedBy.name}` : ''}</div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

async function deleteComplaint(id) {
  if (!confirm('Delete this complaint?')) return;
  try {
    await Complaints.delete(id);
    showPage('my-complaints');
  } catch (err) { alert(err.message); }
}

async function upvoteComplaint(id) {
  try {
    await Complaints.upvote(id);
    viewComplaint(id);
  } catch (err) { alert(err.message); }
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
    if (!document.getElementById('page-dashboard').classList.contains('hidden')) {
      loadDashboard();
    } else {
      loadMyComplaints();
    }
  } catch (err) { alert(err.message); }
}

// ─── Dashboard ────────────────────────────────────────────
async function loadDashboard() {
  // Show loading state
  document.getElementById('dash-stats').innerHTML = `
    <div class="dash-stat"><div class="dash-stat-label">Total</div><div class="dash-stat-num">...</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Open</div><div class="dash-stat-num">...</div></div>
    <div class="dash-stat"><div class="dash-stat-label">In Progress</div><div class="dash-stat-num">...</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Resolved</div><div class="dash-stat-num">...</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Avg. resolution</div><div class="dash-stat-num">...</div></div>
  `;

  try {
    const { stats } = await Dashboard.stats();
    const { byStatus, total, avgResolutionHours } = stats;
    document.getElementById('dash-stats').innerHTML = `
      <div class="dash-stat"><div class="dash-stat-label">Total</div><div class="dash-stat-num">${total}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Open</div><div class="dash-stat-num" style="color:var(--amber)">${byStatus.open || 0}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">In Progress</div><div class="dash-stat-num" style="color:#378ADD">${byStatus['in-progress'] || 0}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Resolved</div><div class="dash-stat-num" style="color:var(--green)">${byStatus.resolved || 0}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Avg. resolution</div><div class="dash-stat-num">${avgResolutionHours ? avgResolutionHours + 'h' : '—'}</div></div>
    `;
  } catch (err) {
    console.error('Dashboard stats error:', err);
    document.getElementById('dash-stats').innerHTML = `<p style="color:red">Error loading stats: ${err.message}</p>`;
  }
  loadDashComplaints();
}

async function loadDashComplaints() {
  const list = document.getElementById('dash-complaints-list');
  list.innerHTML = '<div class="loading">Loading...</div>';
  const params = { limit: 20 };
  const status = document.getElementById('dash-filter-status')?.value;
  const category = document.getElementById('dash-filter-category')?.value;
  if (status) params.status = status;
  if (category) params.category = category;
  try {
    const { complaints } = await Complaints.list(params);
    list.innerHTML = complaints.length
      ? complaints.map(renderComplaintCard).join('')
      : '<div class="empty-state"><h3>No complaints</h3></div>';
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><h3>${err.message}</h3></div>`;
  }
}

// ─── Admin ────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';
  const role = document.getElementById('admin-role-filter')?.value;
  const params = {};
  if (role) params.role = role;
  try {
    const { users } = await Users.list(params);
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>
          <select class="role-select" onchange="updateRole('${u._id}', this.value)">
            <option ${u.role === 'citizen' ? 'selected' : ''}>citizen</option>
            <option ${u.role === 'authority' ? 'selected' : ''}>authority</option>
            <option ${u.role === 'admin' ? 'selected' : ''}>admin</option>
          </select>
        </td>
        <td>${u.area || '—'}</td>
        <td><span class="badge ${u.isActive ? 'badge-resolved' : 'badge-rejected'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
        <td><button class="btn btn-sm btn-outline" onclick="toggleUser('${u._id}')">${u.isActive ? 'Deactivate' : 'Activate'}</button></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
  }
}

async function updateRole(id, role) {
  try { await Users.updateRole(id, role); } catch (err) { alert(err.message); }
}

async function toggleUser(id) {
  try { await Users.toggle(id); loadUsers(); } catch (err) { alert(err.message); }
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

// Load extra numbers from localStorage
function getEmergencyData() {
  const extra = JSON.parse(localStorage.getItem('extraEmergency') || '[]');
  const data = JSON.parse(JSON.stringify(defaultEmergencyData));
  if (extra.length) {
    data.push({ section: '➕ Custom Numbers', cards: extra });
  }
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
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Show add button for admin
  if (currentUser?.role === 'admin') {
    document.getElementById('add-emergency-btn').classList.remove('hidden');
  }
}

function filterEmergency() {
  const query = document.getElementById('emergency-search').value.toLowerCase();
  document.querySelectorAll('.e-card').forEach(card => {
    const name = card.dataset.name || '';
    const number = card.dataset.number || '';
    if (name.includes(query) || number.includes(query)) {
      card.classList.remove('hidden-card');
    } else {
      card.classList.add('hidden-card');
    }
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

  if (!name || !number) {
    alert('Name and number are required!');
    return;
  }

  const extra = JSON.parse(localStorage.getItem('extraEmergency') || '[]');
  extra.push({ name, dept, number, color, icon });
  localStorage.setItem('extraEmergency', JSON.stringify(extra));

  closeEmergencyModal();
  renderEmergencyPage();

  // Clear fields
  document.getElementById('em-name').value = '';
  document.getElementById('em-dept').value = '';
  document.getElementById('em-number').value = '';
  document.getElementById('em-icon').value = '';
}