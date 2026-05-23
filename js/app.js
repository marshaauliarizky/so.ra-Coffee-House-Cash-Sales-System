// ════════════════════════════════════════════
//   app.js — Main Application Logic
// ════════════════════════════════════════════

// ── AUTH (see auth.js) ──
const DELETE_AUTH_CODE = OWNER_PASSWORD;
const SETTINGS_KEY = 'sora_settings';
const DEFAULT_SETTINGS = {
  managerPin: '4321',
  integrations: { grabEnabled: true, gofoodEnabled: true, shopeeEnabled: false },
};
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed, integrations: { ...DEFAULT_SETTINGS.integrations, ...(parsed.integrations || {}) } };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}
function getManagerPin() {
  return (loadSettings().managerPin || '4321').trim();
}
function verifyManagerPin(pin) {
  const expected = getManagerPin();
  if (!expected) return pin === OWNER_PASSWORD;
  return String(pin).trim() === expected;
}
function isChannelIntegrationEnabled(platform) {
  const integ = loadSettings().integrations || {};
  if (platform === 'GrabFood') return integ.grabEnabled !== false;
  if (platform === 'GoFood') return integ.gofoodEnabled !== false;
  if (platform === 'ShopeeFood') return !!integ.shopeeEnabled;
  return true;
}
let isOwner = false;
let deletionLog = [];
let pendingDelete = null;
let deletionIdCounter = 1;
const PAGE_SIZE = 50;
const pagers = {};

const BREADCRUMB = {
  dashboard: ['Overview', 'Dashboard'],
  sales: ['Operations', 'Sales Entry'],
  'today-history': ['Operations', "Today's Transactions"],
  history: ['Transactions', 'Transaction Log'],
  expense: ['Expenses', 'Expense Entry'],
  explog: ['Expenses', 'Expense Log'],
  'deletion-history': ['Accounting', 'Deletion History'],
  recon: ['Accounting', 'Reconciliation'],
  journal: ['Accounting', 'General Ledger'],
  daily: ['Reports', 'Daily Sales Report'],
  report: ['Reports', 'Financial Report'],
  inventory: ['Inventory', 'Stock & Inventory'],
  'menu-management': ['Inventory', 'Menu Management'],
  purchasing: ['Inventory', 'Purchasing'],
  payable: ['Accounting', 'Account Payable'],
  'balance-sheet': ['Reports', 'Balance Sheet'],
};

function applySessionUI() {
  const session = getSession();
  isOwner = session?.role === 'owner';
  const ownerNav = document.getElementById('owner-nav');
  const staffNav = document.getElementById('staff-nav');
  const roleBadge = document.getElementById('role-badge');
  const elevateBtn = document.getElementById('elevate-owner-btn');
  const signOutBtn = document.getElementById('sign-out-btn');
  if (ownerNav) ownerNav.style.display = isOwner ? 'block' : 'none';
  if (staffNav) staffNav.style.display = isOwner ? 'none' : 'block';
  if (roleBadge) {
    roleBadge.textContent = isOwner ? 'Owner' : 'Staff';
    roleBadge.className = 'role-badge ' + (isOwner ? 'owner' : 'staff');
  }
  if (elevateBtn) elevateBtn.style.display = isOwner ? 'none' : 'block';
  if (signOutBtn) signOutBtn.style.display = 'block';

  if (typeof applyI18n === 'function') applyI18n();
  showIncomingOrdersAlert();
  const incomingModal = document.getElementById('incoming-orders-modal');
  if (incomingModal && isOwner) incomingModal.style.display = 'none';
}

function signOut() {
  clearSession();
  window.location.href = 'login.html';
}

function openElevateOwnerModal() {
  const modal = document.getElementById('elevate-owner-modal');
  if (!modal) return;
  document.getElementById('elevate-pw-input').value = '';
  document.getElementById('elevate-pw-error').style.display = 'none';
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('elevate-pw-input')?.focus(), 80);
}

function closeElevateOwnerModal() {
  const modal = document.getElementById('elevate-owner-modal');
  if (modal) modal.style.display = 'none';
}

function confirmElevateOwner() {
  const pw = document.getElementById('elevate-pw-input')?.value || '';
  const err = document.getElementById('elevate-pw-error');
  if (pw !== OWNER_PASSWORD) {
    if (err) { err.textContent = 'Incorrect password.'; err.style.display = 'block'; }
    return;
  }
  setSession({ role: 'owner', name: 'Owner' });
  closeElevateOwnerModal();
  applySessionUI();
  showToast('Owner access unlocked');
}

function initERPUI() { /* reserved */ }

function updateBreadcrumb(page) {
  const bc = document.getElementById('breadcrumb');
  const parts = BREADCRUMB[page] || ['System', page];
  if (bc) bc.innerHTML = `${parts[0]} / <strong>${parts[1]}</strong>`;
}

function renderPagination(key, containerId, total, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!pagers[key]) pagers[key] = { page: 1 };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pagers[key].page > pages) pagers[key].page = pages;
  const page = pagers[key].page;
  const start = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, total);
  el.innerHTML = `
    <div class="pagination-bar">
      <span>Showing ${start}–${end} of ${total.toLocaleString('en-US')} records</span>
      <div class="pagination-btns">
        <button type="button" class="btn-page" ${page <= 1 ? 'disabled' : ''} onclick="changePage('${key}',${page - 1},'${onChange}')">Previous</button>
        <span style="padding:5px 8px">Page ${page} / ${pages}</span>
        <button type="button" class="btn-page" ${page >= pages ? 'disabled' : ''} onclick="changePage('${key}',${page + 1},'${onChange}')">Next</button>
      </div>
    </div>`;
}

function changePage(key, page, fnName) {
  if (!pagers[key]) pagers[key] = { page: 1 };
  pagers[key].page = Math.max(1, page);
  window[fnName]();
}

function loadDeletionLog() {
  try {
    deletionLog = JSON.parse(localStorage.getItem('só.ra_deletion_log') || '[]');
    deletionIdCounter = Math.max(0, ...deletionLog.map(d => d.id || 0)) + 1;
  } catch { deletionLog = []; }
}
function saveDeletionLog() {
  localStorage.setItem('só.ra_deletion_log', JSON.stringify(deletionLog));
}

const ID_MONTHS = {Jan:0,Feb:1,Mar:2,Apr:3,Mei:4,Jun:5,Jul:6,Agu:7,Sep:8,Okt:9,Nov:10,Des:11};
const ID_MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function idDateToComparable(dateStr) {
  if (!dateStr) return 0;
  const raw = String(dateStr).split(',')[0].trim();
  const parts = raw.split(' ');
  if (parts.length < 3) return 0;
  const day = parseInt(parts[0], 10);
  const mon = ID_MONTHS[parts[1]] ?? 0;
  const year = parseInt(String(parts[2]).replace(/[^\d]/g, ''), 10);
  if (!day || !year) return 0;
  return new Date(year, mon, day).getTime();
}
function isoToIdDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'});
}
function displayDateEN(dateStr) {
  if (!dateStr) return '—';
  const t = idDateToComparable(dateStr);
  if (!t) return dateStr;
  return new Date(t).toLocaleDateString('en-US', {day:'numeric', month:'short', year:'numeric'});
}
function formatTopbarDate() {
  return new Date().toLocaleDateString('en-US', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
}
function displayDateTimeEN(str) {
  if (!str) return '—';
  return String(str)
    .replace(/\bMei\b/g, 'May').replace(/\bAgu\b/g, 'Aug')
    .replace(/\bOkt\b/g, 'Oct').replace(/\bDes\b/g, 'Dec')
    .replace(/\bJanuari\b/g, 'January').replace(/\bFebruari\b/g, 'February')
    .replace(/\bMaret\b/g, 'March').replace(/\bApril\b/g, 'April')
    .replace(/\bJuni\b/g, 'June').replace(/\bJuli\b/g, 'July')
    .replace(/\bSeptember\b/g, 'September').replace(/\bOktober\b/g, 'October')
    .replace(/\bNovember\b/g, 'November').replace(/\bDesember\b/g, 'December');
}
function monthInputToMonthKey(val) {
  if (!val) return '';
  const [y, m] = val.split('-');
  return `${ID_MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;
}
function monthInputToLabel(val) {
  if (!val) return 'All periods (cumulative)';
  const d = new Date(val + '-01T12:00:00');
  return d.toLocaleDateString('en-US', {month:'long', year:'numeric'});
}
function isoToMs(iso) {
  if (!iso) return null;
  return new Date(iso + 'T12:00:00').getTime();
}

function normalizeDateRange(fromIso, toIso) {
  let fromMs = isoToMs(fromIso);
  let toMs = isoToMs(toIso);
  let swapped = false;
  if (fromMs != null && toMs != null && fromMs > toMs) {
    [fromMs, toMs] = [toMs, fromMs];
    swapped = true;
  }
  return { fromMs, toMs, swapped };
}

function recordInDateRange(dateStr, fromIso, toIso) {
  if (!fromIso && !toIso) return true;
  const t = idDateToComparable(dateStr);
  if (!t) return false;
  const { fromMs, toMs } = normalizeDateRange(fromIso, toIso);
  if (fromMs != null && t < fromMs) return false;
  if (toMs != null && t > toMs) return false;
  return true;
}
function filterByMonthInput(items, monthVal, dateKey = 'date') {
  if (!monthVal) return items;
  const key = monthInputToMonthKey(monthVal);
  return items.filter(r => dateToMonthKey(r[dateKey]) === key);
}
function currentMonthInput() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}
function onHistoryFilter() {
  pagers.history = { page: 1 };
  renderHistory();
}
function onExpLogFilter() {
  pagers.explog = { page: 1 };
  renderExpLog();
}
function clearHistoryDateFilter() {
  document.getElementById('f-date-from').value = '';
  document.getElementById('f-date-to').value = '';
  onHistoryFilter();
}
function clearExpLogDateFilter() {
  document.getElementById('ef-date-from').value = '';
  document.getElementById('ef-date-to').value = '';
  onExpLogFilter();
}
function onJournalFilter() {
  const monthEl = document.getElementById('jf-month');
  const fromEl = document.getElementById('jf-date-from');
  const toEl = document.getElementById('jf-date-to');
  if (monthEl?.value && fromEl && toEl) {
    fromEl.value = '';
    toEl.value = '';
  } else if ((fromEl?.value || toEl?.value) && monthEl) {
    monthEl.value = '';
  }
  renderJournal();
}

function clearJournalFilter() {
  document.getElementById('jf-month').value = '';
  document.getElementById('jf-date-from').value = '';
  document.getElementById('jf-date-to').value = '';
  renderJournal();
}

function onDeletionHistoryMonthChange() {
  document.getElementById('dh-date-from').value = '';
  document.getElementById('dh-date-to').value = '';
  renderDeletionHistory();
}

function onDeletionHistoryDateChange() {
  document.getElementById('dh-month').value = '';
  renderDeletionHistory();
}

function clearDeletionHistoryFilter() {
  document.getElementById('dh-month').value = '';
  document.getElementById('dh-date-from').value = '';
  document.getElementById('dh-date-to').value = '';
  renderDeletionHistory();
}

function openDeleteModal(type, id, staffMode = false) {
  if (!staffMode && !isOwner) { showToast('Owner access required to delete', 'error'); return; }
  const rec = type === 'transaction'
    ? transactions.find(t => t.id === id)
    : expenses.find(e => e.id === id);
  if (!rec) return;
  pendingDelete = { type, id, rec, staffMode: !!staffMode };
  document.getElementById('delete-modal-title').textContent =
    type === 'transaction' ? `Delete Transaction #TX${id}` : `Delete Expense #EX${id}`;
  document.getElementById('delete-modal-desc').textContent =
    `${rec.date || ''} · ${type === 'transaction' ? fmt(rec.total) : fmt(rec.amount)} — ${type === 'transaction' ? (rec.customer || 'Sale') : rec.description}`;
  document.getElementById('delete-reason').value = '';
  document.getElementById('delete-code').value = '';
  const codeLabel = document.getElementById('delete-code-label');
  if (codeLabel) {
    codeLabel.textContent = staffMode
      ? 'Manager PIN (required — different from owner password)'
      : 'Owner password (required)';
  }
  const codeInput = document.getElementById('delete-code');
  if (codeInput) codeInput.placeholder = staffMode ? 'Manager PIN' : 'Owner password';
  document.getElementById('delete-modal-error').style.display = 'none';
  document.getElementById('delete-modal').style.display = 'flex';
}
function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
  pendingDelete = null;
}
async function confirmDelete() {
  if (!pendingDelete) return;
  const reason = (document.getElementById('delete-reason').value || '').trim();
  const code = document.getElementById('delete-code').value;
  const errEl = document.getElementById('delete-modal-error');
  if (!reason) {
    errEl.textContent = 'Please provide a clear reason for deletion.';
    errEl.style.display = 'block';
    return;
  }
  const staffMode = pendingDelete.staffMode;
  const authOk = staffMode ? verifyManagerPin(code) : (code === OWNER_PASSWORD);
  if (!authOk) {
    errEl.textContent = staffMode ? 'Invalid manager PIN.' : 'Invalid owner password.';
    errEl.style.display = 'block';
    return;
  }
  const {type, id, rec} = pendingDelete;
  const entry = {
    id: deletionIdCounter++,
    deletedAt: nowFull(),
    recordType: type,
    recordId: id,
    originalDate: rec.date || '',
    amount: type === 'transaction' ? rec.total : rec.amount,
    reason,
    deletedBy: staffMode ? 'Staff (manager PIN)' : 'Owner',
    snapshot: type === 'transaction'
      ? {customer: rec.customer, channel: rec.channel, payment: rec.payment}
      : {category: rec.category, description: rec.description, payment: rec.payment}
  };
  if (type === 'transaction') {
    transactions = transactions.filter(t => t.id !== id);
    await fbDeleteTransaction(id);
  } else {
    expenses = expenses.filter(e => e.id !== id);
    await fbDeleteExpense(id);
  }
  deletionLog.unshift(entry);
  saveDeletionLog();
  if (typeof fbSaveDeletionLog === 'function') fbSaveDeletionLog(entry);
  closeDeleteModal();
  populateFilters();
  renderHistory();
  renderExpLog();
  renderDashboard();
  renderReport();
  renderJournal();
  if (currentPage === 'deletion-history') renderDeletionHistory();
  if (currentPage === 'today-history') renderTodayHistory();
  showToast('Record deleted and logged in Deletion History');
}
function filterDeletionLog() {
  const monthVal = document.getElementById('dh-month')?.value || '';
  let fromIso = document.getElementById('dh-date-from')?.value || '';
  let toIso = document.getElementById('dh-date-to')?.value || '';
  const range = normalizeDateRange(fromIso, toIso);
  if (range.swapped && range.fromMs != null && range.toMs != null) {
    document.getElementById('dh-date-from').value = new Date(range.fromMs).toISOString().slice(0, 10);
    document.getElementById('dh-date-to').value = new Date(range.toMs).toISOString().slice(0, 10);
    fromIso = document.getElementById('dh-date-from').value;
    toIso = document.getElementById('dh-date-to').value;
  }
  let list = [...deletionLog];
  if (fromIso || toIso) {
    list = list.filter(d => recordInDateRange(d.deletedAt, fromIso, toIso) || recordInDateRange(d.originalDate, fromIso, toIso));
  } else if (monthVal) {
    const mk = monthInputToMonthKey(monthVal);
    list = list.filter(d => dateToMonthKey(d.deletedAt) === mk || dateToMonthKey(d.originalDate) === mk);
  }
  return list;
}

function renderDeletionHistory() {
  const body = document.getElementById('deletion-history-body');
  if (!body) return;
  const filtered = filterDeletionLog();
  body.innerHTML = filtered.length
    ? filtered.map(d => `
      <tr>
        <td style="font-size:11px">${d.deletedAt}</td>
        <td><span class="badge" style="background:${d.recordType==='transaction'?'#EAF3DE':'#fdecea'};color:${d.recordType==='transaction'?'#3B6D11':'#c0392b'}">${d.recordType==='transaction'?'SALE':'EXPENSE'}</span></td>
        <td style="font-weight:700">${d.recordType==='transaction'?'#TX':'#EX'}${d.recordId}</td>
        <td style="font-size:11px">${d.originalDate}</td>
        <td style="font-weight:700;color:${d.recordType==='transaction'?'#155f48':'#c0392b'}">${fmt(d.amount)}</td>
        <td style="font-size:11px;max-width:220px">${d.reason}</td>
        <td style="font-size:11px;color:#888">${d.deletedBy}</td>
      </tr>`).join('')
    : (deletionLog.length
      ? `<tr><td colspan="7" style="color:#9abfb2;font-style:italic;padding:14px;text-align:center">No deletions in this period. Clear filter to browse all ${deletionLog.length} records.</td></tr>`
      : nodata(7));
}
function deleteActionCell(type, id) {
  return isOwner
    ? `<td class="col-actions"><button type="button" class="btn-row-delete" onclick="openDeleteModal('${type}',${id})">Delete</button></td>`
    : '<td class="col-actions">—</td>';
}

// ── STATE ──
let transactions = [];
let expenses     = [];
let currentOrder = [];
let selectedPay  = 'QRIS';
let selectedCh   = 'Dine-in';
let currentCat   = 'all';
let expandedMenuId = null;
let ingredientDetailFilter = 'all';
let txCounter    = 1;
let expCounter   = 1;
let incomingOrders = [];
let incomingOrderCounter = 1;

// ── HELPERS ──
const fmt     = n  => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const fmtN    = n  => Math.round(n).toLocaleString('id-ID');
const nowFull = () => new Date().toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const today   = () => new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
const nodata  = c  => `<tr><td colspan="${c}" style="color:#9abfb2;font-style:italic;padding:14px;text-align:center">No data available</td></tr>`;
const isToday = t  => (t.date||'')===today();
const pct     = (a,b) => b ? Math.round(a/b*100)+'%' : '0%';

// ── INCOMING ORDERS (Platform Integration) ──
function addIncomingOrder(platform, items, total, notes = '') {
  const order = {
    id: incomingOrderCounter++,
    platform, // 'GrabFood', 'GoFood', 'ShopeeFood', 'Dine-in'
    items,    // [{name, qty, price}]
    total,
    notes,
    receivedAt: nowFull(),
    status: 'pending'
  };
  incomingOrders.unshift(order);
  saveIncomingOrders();
  showIncomingOrdersAlert();
  showToast(`📱 New order from ${platform}`, 'info');
  return order.id;
}

function loadIncomingOrders() {
  try {
    const raw = localStorage.getItem('só.ra_incoming');
    if (!raw) return;
    const data = JSON.parse(raw);
    incomingOrders = data.orders || [];
    incomingOrderCounter = data.counter || (incomingOrders.length + 1);
  } catch { incomingOrders = []; }
}

function saveIncomingOrders() {
  localStorage.setItem('só.ra_incoming', JSON.stringify({ orders: incomingOrders, counter: incomingOrderCounter }));
}

function updateIncomingNavBadge(count) {
  const badge = document.getElementById('incoming-nav-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function showIncomingOrdersAlert() {
  const banner = document.getElementById('incoming-orders-banner');
  const count = incomingOrders.filter(o => o.status === 'pending').length;
  updateIncomingNavBadge(isOwner ? 0 : count);

  if (!banner || isOwner) {
    if (banner) banner.style.display = 'none';
    return;
  }

  if (count > 0) {
    document.getElementById('incoming-count').textContent = `${count} pending order${count > 1 ? 's' : ''} waiting`;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

function seedStaffIncomingOrders() {
  if (isOwner) return;
  if (incomingOrders.some(o => o.status === 'pending')) return;
  addIncomingOrder('GrabFood', [
    { name: 'Kopi Susu Béka', qty: 1, price: 27000 },
    { name: 'Waffle', qty: 1, price: 20000 },
  ], 47000, 'GrabFood #GF-PENDING-001');
}

function openIncomingOrders() {
  // Staff only
  if (isOwner) {
    showToast('Owner access cannot view incoming orders', 'error');
    return;
  }
  
  const modal = document.getElementById('incoming-orders-modal');
  if (!modal) return;
  renderIncomingOrdersList();
  modal.style.display = 'flex';
}

function closeIncomingOrders() {
  const modal = document.getElementById('incoming-orders-modal');
  if (modal) modal.style.display = 'none';
}

function renderIncomingOrdersList() {
  const list = document.getElementById('incoming-orders-list');
  if (!list) return;
  
  const pending = incomingOrders.filter(o => o.status === 'pending');
  if (pending.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px 20px">No pending orders</div>';
    return;
  }
  
  const platformEmojis = {
    'GrabFood': '🍔',
    'GoFood': '🍽️',
    'ShopeeFood': '🛵',
    'Dine-in': '🪑'
  };
  
  list.innerHTML = pending.map(o => `
    <div class="incoming-order-item">
      <div class="incoming-order-header">
        <span class="incoming-order-platform ${o.platform.toLowerCase()}">${platformEmojis[o.platform] || '📦'} ${o.platform}</span>
        <span class="incoming-order-time">${o.receivedAt}</span>
      </div>
      <div class="incoming-order-items">
        ${o.items.map(item => `
          <div class="incoming-order-item-line">
            × ${item.qty} ${item.name} — ${fmt(item.price * item.qty)}
          </div>
        `).join('')}
      </div>
      ${o.notes ? `<div style="font-size:10px;color:#888;margin:8px 0;font-style:italic">📝 ${o.notes}</div>` : ''}
      <div class="incoming-order-price">Total: ${fmt(o.total)}</div>
      <div class="incoming-order-actions">
        <button type="button" class="btn-accept-order" onclick="acceptIncomingOrder(${o.id})">Accept & Process</button>
        <button type="button" class="btn-reject-order" onclick="rejectIncomingOrder(${o.id})">Reject</button>
      </div>
    </div>
  `).join('');
}

function acceptIncomingOrder(orderId) {
  const order = incomingOrders.find(o => o.id === orderId);
  if (!order) return;
  
  // Auto-fill sales form
  currentOrder = order.items.map(item => ({
    id: menu.find(m => m.name === item.name)?.id || null,
    name: item.name,
    price: item.price,
    qty: item.qty
  })).filter(i => i.id);
  
  selectedCh = order.platform;
  selectedPay = 'QRIS'; // default, user dapat ubah
  document.getElementById('cname').value = order.notes || 'Online Order';
  
  // Mark as processed
  order.status = 'accepted';
  incomingOrders = incomingOrders.filter(o => o.id !== orderId);
  saveIncomingOrders();

  closeIncomingOrders();
  sp('sales');
  renderOrderPanel();
  renderMenuGrid();
  showToast(`✓ Order from ${order.platform} loaded — verify & process`, 'success');
  showIncomingOrdersAlert();
}

function rejectIncomingOrder(orderId) {
  const order = incomingOrders.find(o => o.id === orderId);
  if (!order) return;
  
  if (confirm(`Reject order #${order.id} from ${order.platform}?`)) {
    order.status = 'rejected';
    incomingOrders = incomingOrders.filter(o => o.id !== orderId);
    saveIncomingOrders();
    renderIncomingOrdersList();
    showIncomingOrdersAlert();
    showToast(`✗ Order #${order.id} rejected`, 'error');
  }
}

// ── DEMO: INCOMING ORDERS (For Testing/Integration) ──
function demoIncomingOrder(platform) {
  if (typeof isChannelIntegrationEnabled === 'function' && !isChannelIntegrationEnabled(platform)) {
    showToast(`${platform} channel is disabled for incoming orders`, 'error');
    return;
  }
  const demoOrders = {
    'GrabFood': [
      { name: 'Kopi Susu Béka', qty: 2, price: 27000 },
      { name: 'Cafe Latte', qty: 1, price: 30000 },
      { name: 'Waffle', qty: 1, price: 20000 }
    ],
    'GoFood': [
      { name: 'Americano', qty: 3, price: 27000 },
      { name: 'Tiramisu', qty: 2, price: 25000 }
    ],
    'ShopeeFood': [
      { name: 'Nasi Goreng Ayam', qty: 1, price: 30000 },
      { name: 'Iced Tea', qty: 2, price: 18000 }
    ]
  };
  
  const items = demoOrders[platform] || demoOrders['GrabFood'];
  const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const notes = `Order from ${platform} app • #${Math.random().toString(36).substring(7).toUpperCase()}`;
  
  addIncomingOrder(platform, items, total, notes);
}

// ── INIT ──
async function initApp() {
  // Try Firebase first
  const fbOk = await initFirebase();

  if (fbOk) {
    // Attempt to load from Firestore
    const fbData = await fbLoadAll();
    if (fbData && fbData.transactions.length > 0) {
      transactions = fbData.transactions.sort((a,b) => b._ts - a._ts);
      expenses     = fbData.expenses.sort((a,b) => b._ts - a._ts);
      txCounter    = Math.max(...transactions.map(t=>t.id), 0) + 1;
      expCounter   = Math.max(...expenses.map(e=>e.id), 0) + 1;
      console.log(`[App] Loaded from Firebase: ${transactions.length} tx, ${expenses.length} exp`);
    } else {
      // First run — seed Firestore
      loadSeedData();
      await fbSeedAll(transactions, expenses);
    }
  } else {
    // Local mode — use seed generator
    loadSeedData();
  }

  loadDeletionLog();
  loadIncomingOrders();
  loadMenuCatalog();
  loadMenuRecipesStorage();
  populateFilters();
  initCatFilters();
  renderMenuGrid();
  renderDashboard();
  renderTodayExpenses();
  initDefaultMonthFilters();
  
  // Enable demo controls if in development
  const demoControls = document.getElementById('demo-controls');
  if (demoControls && !fbOk) {
    demoControls.style.display = 'block'; // Show for testing in local mode
  }
}

function initDefaultMonthFilters() {
  const cm = currentMonthInput();
  const rep = document.getElementById('rep-month');
  if (rep && !rep.value) rep.value = cm;
}

function loadSeedData() {
  if (typeof SEED_TRANSACTIONS !== 'undefined' && SEED_TRANSACTIONS.length) {
    transactions = [...SEED_TRANSACTIONS].sort((a,b) => b._ts - a._ts);
    txCounter    = SEED_TRANSACTIONS.length + 1;
  }
  if (typeof SEED_EXPENSES !== 'undefined' && SEED_EXPENSES.length) {
    expenses     = [...SEED_EXPENSES].sort((a,b) => b._ts - a._ts);
    expCounter   = SEED_EXPENSES.length + 1;
  }
}

function populateFilters() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const invInput = document.getElementById('exp-invoice-date');
  const dueInput = document.getElementById('exp-due-date');
  if (invInput && !invInput.value) invInput.value = todayIso;
  if (dueInput && !dueInput.value) dueInput.value = todayIso;
}

// ── INVENTORY / PAYABLE DATA (declared early so all functions can access) ──
let inventoryItems = JSON.parse(localStorage.getItem('só.ra_inventory') || '[]');
let purchaseOrders = JSON.parse(localStorage.getItem('só.ra_po') || '[]');
let payables       = JSON.parse(localStorage.getItem('só.ra_payables') || '[]');
function saveInvStorage() { localStorage.setItem('só.ra_inventory', JSON.stringify(inventoryItems)); }
function savePOStorage()  { localStorage.setItem('só.ra_po', JSON.stringify(purchaseOrders)); }
function saveAPStorage()  { localStorage.setItem('só.ra_payables', JSON.stringify(payables)); }

const OP_JOURNAL_CATS = ['Salary Expense','Rent Expense','Utilities Expense','Marketing Expense','Maintenance Expense','Other Expense'];

function getInvItem(name) {
  return inventoryItems.find(i => i.name === name);
}
function getRecipeLines(menuId) {
  return (typeof menuRecipes !== 'undefined' && menuRecipes[menuId]) ? menuRecipes[menuId] : [];
}
function getMenuIngredientStock(menuId) {
  const recipe = getRecipeLines(menuId);
  if (!recipe.length) return null;
  return recipe.map(line => {
    const inv = getInvItem(line.inv);
    const avail = inv ? inv.qty : 0;
    const maxServings = line.qty > 0 ? Math.floor(avail / line.qty) : 0;
    return { name: line.inv, need: line.qty, unit: line.unit || inv?.unit || '', avail, maxServings };
  });
}
function maxServingsForMenu(menuId) {
  const lines = getMenuIngredientStock(menuId);
  if (!lines || !lines.length) return null;
  return Math.min(...lines.map(l => l.maxServings));
}
function orderStockShortages(order) {
  const shortages = [];
  order.forEach(o => {
    getRecipeLines(o.id).forEach(line => {
      const inv = getInvItem(line.inv);
      const need = line.qty * o.qty;
      const avail = inv ? inv.qty : 0;
      if (need > avail) shortages.push({ menu: o.name, ingredient: line.inv, need, avail, unit: line.unit || inv?.unit || '' });
    });
  });
  return shortages;
}
function deductInventoryForOrder(order) {
  let cogsTotal = 0;
  order.forEach(o => {
    getRecipeLines(o.id).forEach(line => {
      const inv = getInvItem(line.inv);
      if (!inv) return;
      const useQty = line.qty * o.qty;
      inv.qty = Math.max(0, inv.qty - useQty);
      inv.updated = today();
      const unitCost = inv.unitCost != null ? inv.unitCost : (typeof DEFAULT_INV_UNIT_COST !== 'undefined' ? DEFAULT_INV_UNIT_COST : 15000);
      cogsTotal += useQty * unitCost;
    });
  });
  saveInvStorage();
  return cogsTotal;
}
function recordSaleCogs(cogsAmount, txId) {
  if (cogsAmount <= 0) return;
  const newExp = {
    id: expCounter++, fullTime: nowFull(), date: today(), _ts: Date.now(),
    category: 'Cost of Goods Sold', description: `COGS — Sale #TX${txId}`, amount: cogsAmount, payment: 'Inventory',
  };
  expenses.unshift(newExp);
  fbSaveExpense(newExp);
}

// ── NAVIGATION ──
const pages = ['dashboard','sales','history','today-history','expense','explog','recon','journal','report','daily','deletion-history','inventory','menu-management','purchasing','payable','balance-sheet'];
let currentPage = 'dashboard';
function navElFor(pageKey) {
  const navId = pageKey === 'menu-management' ? 'nav-menu-mgmt' : 'nav-' + pageKey;
  const primary = document.getElementById(navId);
  const ownerSpecific = document.getElementById('nav-owner-' + pageKey);
  if (isOwner && ownerSpecific) return ownerSpecific;
  return primary || ownerSpecific;
}
function setActiveNavFor(pageKey) {
  document.querySelectorAll('.nav-item').forEach(nv => nv.classList.remove('active'));
  const primary = navElFor(pageKey);
  if (primary) primary.classList.add('active');
  document.querySelectorAll(`[data-page-nav="${pageKey}"]`).forEach(nv => nv.classList.add('active'));
}
function sp(p) {
  // #region agent log
  const missingNav = pages.filter(x => !navElFor(x));
  const missingPage = pages.filter(x => !document.getElementById('page-' + x));
  fetch('http://127.0.0.1:7868/ingest/2069df56-a0ff-4cf6-a50c-cea3b9d7b86c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'09e7bf'},body:JSON.stringify({sessionId:'09e7bf',location:'app.js:sp:entry',message:'sp navigation',data:{target:p,missingNav,missingPage,runId:'pre-fix'},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  currentPage = p;
  pages.forEach(x=>{
    const pe = document.getElementById('page-'+x);
    if (pe) pe.classList.add('hidden');
  });
  const pageEl = document.getElementById('page-'+p);
  if (pageEl) pageEl.classList.remove('hidden');
  setActiveNavFor(p);
  const incNav = document.getElementById('nav-incoming-orders');
  if (incNav) incNav.classList.remove('active');
  const titles={
    dashboard:'Dashboard',sales:'Sales Entry',history:'Transaction Log',
    'today-history':"Today's Transactions",
    expense:'Expense Entry',explog:'Expense Log',
    recon:'Cash Reconciliation',journal:'General Ledger',report:'Financial Report',
    daily:'Daily Sales Report','deletion-history':'Deletion History',
    inventory:'Stock & Inventory','menu-management':'Menu Management',
    purchasing:'Purchasing',payable:'Account Payable','balance-sheet':'Balance Sheet'
  };
  const titleKeys = {
    dashboard:'nav.dashboard', sales:'nav.sales', history:'nav.history', 'today-history':'nav.today',
    expense:'nav.expense', explog:'nav.explog', recon:'nav.recon', journal:'nav.journal', report:'nav.report',
    daily:'nav.daily', 'deletion-history':'nav.deletion', inventory:'nav.inventory',
    'menu-management':'nav.menu-mgmt', purchasing:'nav.purchasing', payable:'nav.payable', 'balance-sheet':'nav.balance',
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) {
    const tk = titleKeys[p];
    titleEl.textContent = (tk && typeof t === 'function') ? t(tk) : (titles[p] || p);
  }
  updateBreadcrumb(p);
  if (typeof applyI18n === 'function') applyI18n();
  if(p==='dashboard') renderDashboard();
  if(p==='history')   renderHistory();
  if(p==='explog')    renderExpLog();
  if(p==='recon')     renderRecon();
  if(p==='journal')   renderJournal();
  if(p==='report')    renderReport();
  if(p==='daily')     renderDailyReport();
  if(p==='expense')   { renderTodayExpenses(); updateExpenseRouting(); }
  if(p==='today-history') renderTodayHistory();
  if(p==='deletion-history') renderDeletionHistory();
  if(p==='inventory')   renderInventory();
  if(p==='purchasing')  renderPurchasing();
  if(p==='payable')     renderPayable();
  if(p==='balance-sheet') renderBalanceSheet();
  if(p==='menu-management') renderMenuManagement();
}

// ── CATEGORY FILTERS ──
function initCatFilters() {
  const div = document.getElementById('cat-filters');
  if(!div) return;
  div.innerHTML = `<button class="cf active" onclick="filterCat('all')" id="cf-all">All</button>`+
    cats.map(c=>`<button class="cf" onclick="filterCat('${c.replace(/'/g,"\\'")}\')" id="cf-${c.replace(/\s/g,'-').replace(/'/g,'')}">${c}</button>`).join('');
}
function filterCat(cat) {
  currentCat=cat;
  expandedMenuId = null;
  document.querySelectorAll('.cf').forEach(b=>b.classList.remove('active'));
  const safeid = cat==='all'?'all':cat.replace(/\s/g,'-').replace(/'/g,'');
  const el=document.getElementById('cf-'+safeid);
  if(el) el.classList.add('active');
  renderMenuGrid();
}

// ── MENU GRID ──
function ingredientStockStatus(line) {
  const inv = getInvItem(line.name);
  const min = inv ? inv.min : 0;
  if (line.avail <= 0) return { label: 'Out', cls: 'out' };
  if (line.avail <= min || line.maxServings <= 3) return { label: 'Low', cls: 'low' };
  return { label: 'OK', cls: 'ok' };
}

function toggleMenuDetail(id) {
  expandedMenuId = expandedMenuId === id ? null : id;
  ingredientDetailFilter = 'all';
  renderMenuGrid();
  renderMenuIngredientDetail();
}

function setIngredientDetailFilter(filter) {
  ingredientDetailFilter = filter || 'all';
  renderMenuIngredientDetail();
}

function renderMenuIngredientDetail() {
  const panel = document.getElementById('menu-ingredient-detail');
  if (!panel) return;
  if (!expandedMenuId) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }
  const item = menu.find(m => m.id === expandedMenuId);
  const recipe = getMenuIngredientStock(expandedMenuId);
  if (!item) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  if (!recipe || !recipe.length) {
    panel.innerHTML = `
      <div class="mip-title">${item.name}</div>
      <div style="font-size:12px;color:#888;margin-bottom:10px">No recipe linked — stock not tracked per ingredient.</div>
      <button type="button" onclick="openRecipeBuilderForMenu(${item.id})" style="padding:8px 12px;border:1.5px solid #0f7a5a;background:#0f7a5a;color:#fff;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">+ Add Recipe & Stock</button>`;
    return;
  }
  const maxServ = maxServingsForMenu(expandedMenuId);
  const visibleRecipe = ingredientDetailFilter === 'low'
    ? recipe.filter(line => {
        const st = ingredientStockStatus(line);
        return st.cls === 'low' || st.cls === 'out';
      })
    : recipe;
  const editBtn = isOwner
    ? `<button type="button" onclick="openRecipeBuilderForMenu(${item.id})" style="padding:7px 10px;border:1.5px solid #0f7a5a;background:#0f7a5a;color:#fff;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer">Edit Recipe & Stock</button>`
    : '';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px">
      <div class="mip-title" style="margin:0">${item.name} — Ingredients (per serving)</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button type="button" onclick="setIngredientDetailFilter('all')" style="padding:6px 9px;border:1px solid #c8e6dc;background:${ingredientDetailFilter === 'all' ? '#0f7a5a' : '#fff'};color:${ingredientDetailFilter === 'all' ? '#fff' : '#0f7a5a'};border-radius:7px;font-size:10px;font-weight:800;cursor:pointer">All Ingredients</button>
        <button type="button" onclick="setIngredientDetailFilter('low')" style="padding:6px 9px;border:1px solid #f3c27a;background:${ingredientDetailFilter === 'low' ? '#e67e22' : '#fff'};color:${ingredientDetailFilter === 'low' ? '#fff' : '#e67e22'};border-radius:7px;font-size:10px;font-weight:800;cursor:pointer">Low/Out Stock</button>
        ${editBtn}
      </div>
    </div>
    ${maxServ !== null ? `<div style="font-size:11px;color:#4a7a65;margin-bottom:8px">Est. servings available: <strong>${maxServ}</strong></div>` : ''}
    ${visibleRecipe.length ? visibleRecipe.map(line => {
      const st = ingredientStockStatus(line);
      const badge = st.cls === 'out'
        ? '<span class="badge" style="background:#fdecea;color:#c0392b">Out</span>'
        : st.cls === 'low'
        ? '<span class="badge" style="background:#fff3e0;color:#e65100">Low</span>'
        : '<span class="badge" style="background:#e8f5e9;color:#2e7d32">OK</span>';
      return `<div class="mip-row">
        <span><strong>${line.name}</strong> <span style="color:#888;font-size:10px">need ${line.need} ${line.unit}/serving</span></span>
        <span style="text-align:right">${badge} <strong>${line.avail}</strong> ${line.unit} on hand</span>
      </div>`;
    }).join('') : `<div style="font-size:12px;color:#888;padding:8px 0">No low/out stock ingredients for this menu.</div>`}
    <div style="margin-top:10px;font-size:11px;color:#888">Use <strong>+</strong> on the card to add to order. Owner can edit recipe and inventory from this panel.</div>`;
}

function renderMenuGrid() {
  const items=currentCat==='all'?menu:menu.filter(m=>m.cat===currentCat);
  const mg = document.getElementById('menu-grid');
  if(!mg) return;
  mg.innerHTML=items.map(m=>{
    const recipe = getMenuIngredientStock(m.id);
    const hasRecipe = recipe && recipe.length;
    const inOrder = currentOrder.find(o=>o.id===m.id);
    const expanded = expandedMenuId === m.id;
    let stockHint = '';
    if (hasRecipe) {
      const maxServ = maxServingsForMenu(m.id);
      const lowIng = recipe.find(l => l.avail <= 0 || l.maxServings <= 0);
      if (maxServ === 0 || lowIng) {
        stockHint = `<div class="mi-stock mi-stock-out">Out of stock</div>`;
      } else if (maxServ <= 3) {
        stockHint = `<div class="mi-stock mi-stock-low">Low stock</div>`;
      } else {
        stockHint = `<div class="mi-stock mi-stock-ok">In stock</div>`;
      }
    }
    return `<div class="mi ${inOrder?'sel':''} ${expanded?'expanded':''}" onclick="toggleMenuDetail(${m.id})">
      ${hasRecipe ? `<button type="button" class="mi-add-btn" onclick="event.stopPropagation();addToOrder(${m.id})" title="Add to order">+</button>` : ''}
      <div class="mi-cat-dot" style="background:${catColor(m.cat)}"></div>
      <div class="mi-name">${m.name}</div>
      <div class="mi-cat">${m.cat}</div>
      <div class="mi-price">${fmt(m.price)}</div>
      ${stockHint}
      ${hasRecipe ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:4px"><span style="font-size:9px;color:#888">Click for ingredients</span>${isOwner ? `<button type="button" onclick="event.stopPropagation();openRecipeBuilderForMenu(${m.id})" style="padding:4px 7px;border:1px solid #0f7a5a;background:#eef8f4;color:#0f7a5a;border-radius:7px;font-size:9px;font-weight:800;cursor:pointer">Edit</button>` : ''}</div>` : `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:7px"><button type="button" onclick="event.stopPropagation();openRecipeBuilderForMenu(${m.id})" style="padding:5px 8px;border:1px solid #0f7a5a;background:#eef8f4;color:#0f7a5a;border-radius:7px;font-size:10px;font-weight:800;cursor:pointer">+ Recipe</button><button type="button" class="mi-add-btn" style="top:auto;bottom:8px" onclick="event.stopPropagation();addToOrder(${m.id})">+</button></div>`}
    </div>`;
  }).join('');
  renderMenuIngredientDetail();
}
function catColor(cat) {
  const map={'Andalan':'#f0c419','Klasik':'#1a7a5e','Frappe':'#9b59b6','Bukan Kopi':'#e67e22',
             'Frappucino':'#3498db','Slush':'#1abc9c','Cemilan':'#e91e63','Makanan':'#795548'};
  return map[cat]||'#888';
}

// ── ORDER / SALES ──
function addToOrder(id) {
  const item=menu.find(m=>m.id===id);
  const ex=currentOrder.find(o=>o.id===id);
  const trial = ex ? [{ ...item, qty: ex.qty + 1 }] : [{ ...item, qty: 1 }];
  const shortages = orderStockShortages(trial);
  if (shortages.length) {
    const s = shortages[0];
    showToast(`Insufficient stock: ${s.ingredient} (need ${s.need} ${s.unit}, have ${s.avail})`, 'error');
    return;
  }
  if(ex){ex.qty++;}else{currentOrder.push({...item,qty:1});}
  renderOrderPanel(); renderMenuGrid(); updateSalesJournalPreview();
}
function changeQty(id,delta) {
  const i=currentOrder.findIndex(o=>o.id===id);
  if(i<0) return;
  const item = currentOrder[i];
  if (delta > 0) {
    const shortages = orderStockShortages([{ ...item, qty: item.qty + 1 }]);
    if (shortages.length) {
      showToast(`Insufficient stock: ${shortages[0].ingredient}`, 'error');
      return;
    }
  }
  currentOrder[i].qty+=delta;
  if(currentOrder[i].qty<=0) currentOrder.splice(i,1);
  renderOrderPanel(); renderMenuGrid(); updateSalesJournalPreview();
}
function clearOrder() {
  currentOrder=[];
  document.getElementById('cname').value='';
  renderOrderPanel(); renderMenuGrid();
  document.getElementById('sales-jp').style.display='none';
}
function renderOrderPanel() {
  const list=document.getElementById('order-list');
  list.innerHTML=currentOrder.length===0
    ?'<div class="eo">Select items from the menu panel</div>'
    :currentOrder.map(o=>`
      <div class="oir">
        <div class="oin">${o.name}<br><span style="font-size:10px;color:#4a7a65">${fmt(o.price)} / item</span></div>
        <div class="qc">
          <button class="qb" onclick="changeQty(${o.id},-1)">−</button>
          <span class="qn">${o.qty}</span>
          <button class="qb" onclick="changeQty(${o.id},1)">+</button>
        </div>
        <div class="is">${fmt(o.price*o.qty)}</div>
      </div>`).join('');
  const total=currentOrder.reduce((s,o)=>s+o.price*o.qty,0);
  document.getElementById('order-subtotal').textContent=fmt(total);
  document.getElementById('order-total').textContent=fmt(total);
  document.getElementById('btn-proc').disabled=currentOrder.length===0;
}
function selPay(m) {
  selectedPay=m;
  ['QRIS','Debit','Transfer'].forEach(x=>document.getElementById('pay-'+x).classList.toggle('active',x===m));
  updateSalesJournalPreview();
}
function selCh(c) {
  selectedCh=c;
  ['Dine-in','GoFood','GrabFood','ShopeeFood'].forEach(x=>document.getElementById('ch-'+x).classList.toggle('active',x===c));
}
function updateSalesJournalPreview() {
  const total=currentOrder.reduce((s,o)=>s+o.price*o.qty,0);
  if(!total){document.getElementById('sales-jp').style.display='none';return;}
  const acct=acctMap[selectedPay]||selectedPay;
  document.getElementById('sales-jp').style.display='block';
  document.getElementById('sales-jp-content').innerHTML=`
    <div class="jp-row"><span class="jp-acct">${acct}</span><span class="jp-dr">${fmtN(total)}</span><span class="jp-cr">—</span></div>
    <div class="jp-row"><span class="jp-acct jp-indent">Sales Revenue</span><span class="jp-dr">—</span><span class="jp-cr">${fmtN(total)}</span></div>`;
}
async function processOrder() {
  if(!currentOrder.length) return;
  const shortages = orderStockShortages(currentOrder);
  if (shortages.length) {
    showToast(`Cannot complete order — ${shortages.map(s => `${s.ingredient} (${s.avail}/${s.need} ${s.unit})`).join(', ')}`, 'error');
    return;
  }
  const total=currentOrder.reduce((s,o)=>s+o.price*o.qty,0);
  const cname=document.getElementById('cname').value.trim()||'Walk-in';
  const txId = txCounter++;
  const orderSnapshot = [...currentOrder];
  const cogsAmount = deductInventoryForOrder(orderSnapshot);
  const newTx = {
    id:txId, fullTime:nowFull(), date:today(), _ts:Date.now(),
    customer:cname, channel:selectedCh, items:orderSnapshot, payment:selectedPay, total
  };
  transactions.unshift(newTx);
  fbSaveTransaction(newTx);
  recordSaleCogs(cogsAmount, txId);
  currentOrder=[];
  document.getElementById('cname').value='';
  document.getElementById('sales-jp').style.display='none';
  renderOrderPanel(); renderMenuGrid();
  showReceiptModal(newTx);
  renderDashboard();
  if (currentPage === 'today-history') renderTodayHistory();
  if (currentPage === 'history') renderHistory();
  if (currentPage === 'inventory') renderInventory();
}

// ── RECEIPT MODAL ──
function showReceiptModal(transaction) {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;
  
  // Fill receipt details
  document.getElementById('receipt-tx-id').textContent = transaction.id;
  document.getElementById('receipt-tx-date').textContent = transaction.fullTime;
  document.getElementById('receipt-customer').textContent = transaction.customer || 'Walk-in';
  document.getElementById('receipt-channel').textContent = transaction.channel || '—';
  document.getElementById('receipt-payment').textContent = transaction.payment || '—';
  document.getElementById('receipt-total').textContent = fmt(transaction.total);
  
  // Fill items
  const itemsHtml = transaction.items.map(item => `
    <div class="receipt-item-row">
      <span class="receipt-item-name">${item.name}</span>
      <span class="receipt-item-qty">× ${item.qty}</span>
      <span class="receipt-item-total">${fmt(item.price * item.qty)}</span>
    </div>`).join('');
  document.getElementById('receipt-items').innerHTML = itemsHtml;
  
  // Store current transaction for print
  window.currentReceipt = transaction;
  
  // Show modal
  modal.style.display = 'flex';
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  if (modal) modal.style.display = 'none';
}

function printReceipt() {
  const receipt = window.currentReceipt;
  if (!receipt) return;
  
  const printWindow = window.open('', '', 'height=400,width=300');
  const itemsHtml = receipt.items.map(item => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #ddd">${item.name}</td>
      <td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:center">× ${item.qty}</td>
      <td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;font-weight:bold">${fmt(item.price * item.qty)}</td>
    </tr>`).join('');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt #${receipt.id}</title>
      <style>
        body { font-family:monospace; width:280px; margin:0 auto; padding:10px; font-size:12px; }
        .header { text-align:center; margin-bottom:16px; border-bottom:1px solid #000; padding-bottom:8px; }
        .title { font-weight:bold; font-size:14px; margin-bottom:4px; }
        .subtitle { font-size:10px; color:#666; }
        .receipt-no { font-weight:bold; margin-top:8px; }
        .items { margin:12px 0; }
        .item-row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #ddd; font-size:11px; }
        .item-name { flex:2; }
        .item-qty { flex:0 0 auto; text-align:center; margin:0 8px; }
        .item-price { flex:0 0 auto; text-align:right; font-weight:bold; }
        .footer { margin-top:12px; border-top:1px solid #000; padding-top:8px; }
        .total-row { display:flex; justify-content:space-between; font-weight:bold; font-size:13px; margin-bottom:8px; }
        .detail-row { display:flex; justify-content:space-between; font-size:10px; margin:2px 0; }
        .thanks { text-align:center; margin-top:12px; font-size:10px; color:#666; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">só.ra Coffee House</div>
        <div class="subtitle">Accounting Information System</div>
      </div>
      
      <div class="receipt-no">ORDER #${receipt.id}</div>
      <div style="font-size:10px;color:#666;margin-bottom:12px">${receipt.fullTime}</div>
      
      <div class="items">
        ${receipt.items.map(item => `
          <div class="item-row">
            <div class="item-name">${item.name}</div>
            <div class="item-qty">× ${item.qty}</div>
            <div class="item-price">${fmt(item.price * item.qty)}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="footer">
        <div class="detail-row">
          <span>Customer:</span>
          <strong>${receipt.customer || 'Walk-in'}</strong>
        </div>
        <div class="detail-row">
          <span>Channel:</span>
          <strong>${receipt.channel || '—'}</strong>
        </div>
        <div class="detail-row">
          <span>Payment:</span>
          <strong>${receipt.payment || '—'}</strong>
        </div>
        <div class="total-row" style="margin-top:8px">
          <span>TOTAL</span>
          <span>${fmt(receipt.total)}</span>
        </div>
      </div>
      
      <div class="thanks">✓ Payment Successful</div>
      <div class="thanks" style="margin-top:4px">Thank you for your order!</div>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}


// ── EXPENSE ──
function expenseCreditAccount(pay) {
  return pay === 'Transfer' ? 'Cash — Bank Transfer' : pay === 'Debit' ? 'Cash — Debit' : 'Cash';
}

function isExpensePayLater() {
  const settlement = document.getElementById('exp-settlement')?.value;
  if (settlement === 'credit') return true;
  if (settlement === 'cash') return false;
  const dueVal = document.getElementById('exp-due-date')?.value;
  const invVal = document.getElementById('exp-invoice-date')?.value;
  if (!dueVal) return false;
  const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
  const due = new Date(dueVal); due.setHours(0, 0, 0, 0);
  if (due > todayD) return true;
  if (invVal) {
    const inv = new Date(invVal); inv.setHours(0, 0, 0, 0);
    if (due > inv) return true;
  }
  return false;
}

function updateExpenseRouting() {
  const infoEl = document.getElementById('exp-routing-info');
  const btnEl = document.getElementById('exp-submit-btn');
  const payLater = isExpensePayLater();
  if (infoEl) {
    if (payLater) {
      const dueVal = document.getElementById('exp-due-date')?.value || '';
      infoEl.style.display = 'block';
      infoEl.style.background = '#fff3e0';
      infoEl.style.color = '#e65100';
      infoEl.innerHTML = `Future due date — recorded as <strong>Account Payable</strong> until paid (due ${dueVal ? displayDateEN(isoToIdDate(dueVal)) : '—'}).`;
      if (btnEl) btnEl.textContent = '✓ Record as Account Payable';
    } else {
      infoEl.style.display = 'none';
      if (btnEl) btnEl.textContent = '✓ Record Expense (Cash)';
    }
  }
  updateExpPreview();
}

function resetExpenseForm() {
  const todayIso = new Date().toISOString().slice(0, 10);
  ['exp-cat', 'exp-supplier', 'exp-desc', 'exp-amount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const inv = document.getElementById('exp-invoice-date');
  const due = document.getElementById('exp-due-date');
  if (inv) inv.value = todayIso;
  if (due) due.value = todayIso;
  const sett = document.getElementById('exp-settlement');
  if (sett) sett.value = 'cash';
  document.getElementById('exp-preview').innerHTML = '<div class="eo">Fill in the form to preview</div>';
  document.getElementById('exp-jp').style.display = 'none';
  const ri = document.getElementById('exp-routing-info');
  if (ri) ri.style.display = 'none';
  const btnEl = document.getElementById('exp-submit-btn');
  if (btnEl) btnEl.textContent = '✓ Record Expense';
}

function updateExpPreview() {
  const cat = document.getElementById('exp-cat').value;
  const supplier = document.getElementById('exp-supplier')?.value.trim() || '';
  const desc = document.getElementById('exp-desc').value;
  const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
  const pay = document.getElementById('exp-pay').value;
  const payLater = isExpensePayLater();
  const prev = document.getElementById('exp-preview');
  if (!cat || !amount) {
    prev.innerHTML = '<div class="eo">Fill in the form to preview</div>';
    document.getElementById('exp-jp').style.display = 'none';
    return;
  }
  prev.innerHTML = `
    <div style="background:white;border-radius:8px;padding:12px;border:1px solid #f5c6cb">
      <div style="font-size:11px;color:#888;margin-bottom:8px">${payLater ? 'ACCOUNT PAYABLE PREVIEW' : 'EXPENSE ENTRY PREVIEW'}</div>
      <div style="font-weight:700;color:#c0392b;font-size:14px;margin-bottom:4px">${cat}</div>
      ${supplier ? `<div style="font-size:11px;color:#888;margin-bottom:4px">${supplier}</div>` : ''}
      <div style="font-size:12px;color:#555;margin-bottom:8px">${desc || '—'}</div>
      <div style="display:flex;justify-content:space-between;font-size:13px">
        <span>${payLater ? 'Pay later (AP)' : `Payment via <strong>${pay}</strong>`}</span>
        <strong style="color:#c0392b;font-size:16px">${fmt(amount)}</strong>
      </div>
    </div>`;
  const jp = document.getElementById('exp-jp');
  const jpContent = document.getElementById('exp-jp-content');
  if (!jp || !jpContent) return;
  if (payLater) {
    jp.style.display = 'block';
    jpContent.innerHTML = `
      <div class="jp-row"><span class="jp-acct">${expAcct[cat] || cat}</span><span class="jp-dr">${fmtN(amount)}</span><span class="jp-cr">—</span></div>
      <div class="jp-row"><span class="jp-acct jp-indent">Accounts Payable</span><span class="jp-dr">—</span><span class="jp-cr">${fmtN(amount)}</span></div>`;
  } else {
    const creditAcct = expenseCreditAccount(pay);
    jp.style.display = 'block';
    jpContent.innerHTML = `
      <div class="jp-row"><span class="jp-acct">${expAcct[cat] || cat}</span><span class="jp-dr">${fmtN(amount)}</span><span class="jp-cr">—</span></div>
      <div class="jp-row"><span class="jp-acct jp-indent">${creditAcct}</span><span class="jp-dr">—</span><span class="jp-cr">${fmtN(amount)}</span></div>`;
  }
}

async function processExpense() {
  const cat = document.getElementById('exp-cat').value;
  const supplier = document.getElementById('exp-supplier')?.value.trim() || '';
  const desc = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
  const pay = document.getElementById('exp-pay').value;
  const invoiceVal = document.getElementById('exp-invoice-date')?.value;
  const dueVal = document.getElementById('exp-due-date')?.value;
  if (!cat || !amount || !desc || !supplier) {
    showToast('Please fill category, supplier, description, and amount', 'error');
    return;
  }
  if (!invoiceVal || !dueVal) {
    showToast('Please set invoice date and due date', 'error');
    return;
  }

  const payLater = isExpensePayLater();
  const invoiceDate = isoToIdDate(invoiceVal);
  const dueDate = isoToIdDate(dueVal);

  if (payLater) {
    payables.push({
      id: Date.now(),
      supplier,
      desc: `${cat}: ${desc}`,
      amount,
      invoiceDate,
      dueDate,
      rawDue: dueVal,
      rawInvoice: invoiceVal,
      status: 'unpaid',
      paidDate: null,
    });
    saveAPStorage();
    resetExpenseForm();
    showToast(`✓ Account Payable recorded — due ${dueDate}`, 'info');
    if (currentPage === 'payable') renderPayable();
    return;
  }

  const dateObj = new Date(invoiceVal + 'T12:00:00');
  const fullTime = dateObj.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dateOnly = invoiceDate;
  const newExp = {
    id: expCounter++,
    fullTime,
    date: dateOnly,
    _ts: dateObj.getTime(),
    category: cat,
    description: supplier ? `${supplier} — ${desc}` : desc,
    amount,
    payment: pay,
  };
  expenses.unshift(newExp);
  fbSaveExpense(newExp);
  resetExpenseForm();
  renderTodayExpenses();
  renderJournal();
  showToast(`✓ Expense recorded — ${fmt(amount)}`);
  renderDashboard();
}
function renderTodayExpenses() {
  const todayExp=expenses.filter(e=>isToday(e));
  const el=document.getElementById('today-exp-list');
  if(!el) return;
  if(!todayExp.length){el.innerHTML='<div style="color:#9abfb2;font-size:12px;font-style:italic;padding:10px 0">No expenses recorded today</div>';return;}
  el.innerHTML=todayExp.map(e=>`
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5c6cb;font-size:12px">
      <div><div style="font-weight:600;color:#c0392b">${e.category}</div><div style="color:#888;font-size:10px">${e.description}</div></div>
      <strong style="color:#c0392b">${fmt(e.amount)}</strong>
    </div>`).join('');
}

// ── TOAST ──
function showToast(msg, type='success') {
  const t=document.getElementById('toast');
  t.textContent=msg;
  let bgColor = '#155f48'; // default green
  if (type === 'error') bgColor = '#c0392b'; // red
  if (type === 'info') bgColor = '#2980b9';  // blue
  if (type === 'warning') bgColor = '#f39c12'; // orange
  t.style.background = bgColor;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

// ── DASHBOARD ──
function renderDashboard() {
  const todayTx     = transactions.filter(isToday);
  const todayExp    = expenses.filter(isToday);
  const todayRev    = todayTx.reduce((s,t)=>s+t.total,0);
  const todayExpTot = todayExp.reduce((s,e)=>s+e.amount,0);
  const profit      = todayRev - todayExpTot;
  const allRev      = transactions.reduce((s,t)=>s+t.total,0);
  const allExp      = expenses.reduce((s,e)=>s+e.amount,0);

  // Yesterday for comparison
  const yd = new Date(); yd.setDate(yd.getDate()-1);
  const ydStr = yd.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  const ydRev = transactions.filter(t=>t.date===ydStr).reduce((s,t)=>s+t.total,0);
  const revChg = ydRev ? ((todayRev-ydRev)/ydRev*100).toFixed(1) : null;
  const revChgHtml = revChg!==null
    ? `<span style="font-size:10px;color:${revChg>=0?'#27ae60':'#c0392b'}">${revChg>=0?'▲':'▼'} ${Math.abs(revChg)}% vs yesterday</span>`
    : '';

  document.getElementById('s-rev').textContent    = fmt(todayRev);
  document.getElementById('s-tc').innerHTML       = todayTx.length+' transactions '+revChgHtml;
  document.getElementById('s-exp').textContent    = fmt(todayExpTot);
  document.getElementById('s-ec').textContent     = todayExp.length+' entries';
  document.getElementById('s-profit').textContent = fmt(profit);
  document.getElementById('s-profit').style.color = profit>=0?'#27ae60':'#c0392b';
  const mtdKey = monthInputToMonthKey(currentMonthInput());
  const mtdTx = transactions.filter(t => dateToMonthKey(t.date) === mtdKey);
  const mtdRev = mtdTx.reduce((s, t) => s + t.total, 0);
  document.getElementById('s-mtd-rev').textContent = fmt(mtdRev);
  document.getElementById('s-mtd-sub').textContent =
    `${mtdTx.length} transactions · ${monthInputToLabel(currentMonthInput())}`;

  // 7-day revenue trend
  const trend7 = [];
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
    const rev=transactions.filter(t=>t.date===ds).reduce((s,t)=>s+t.total,0);
    const label=d.toLocaleDateString('en-US',{weekday:'short',day:'numeric'});
    trend7.push({label,rev,ds});
  }
  const maxRev = Math.max(...trend7.map(x=>x.rev),1);
  document.getElementById('trend-chart').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;height:80px;width:100%;gap:4px;">
      ${trend7.map(d=>`
        <div style="flex:1 1 0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;min-width:0;">
          <div style="font-size:9px;color:#888;font-weight:600">${d.rev?''+Math.round(d.rev/1000)+'k':''}</div>
          <div style="width:100%;background:${d.ds===today()?'#f0c419':'#c8e6dc'};border-radius:4px 4px 0 0;height:${Math.max(4,Math.round(d.rev/maxRev*60))}px;transition:height .3s"></div>
          <div style="font-size:9px;color:#4a7a65;text-align:center;white-space:nowrap;">${d.label}</div>
        </div>`).join('')}
    </div>`;

  // Today sales by channel chart removed per request
  // Top menu items
  const mS={};
  transactions.forEach(t=>t.items.forEach(i=>{
    if(!mS[i.name])mS[i.name]={qty:0,rev:0,cat:i.cat};
    mS[i.name].qty+=i.qty; mS[i.name].rev+=i.price*i.qty;
  }));
  const top5=Object.entries(mS).sort((a,b)=>b[1].qty-a[1].qty).slice(0,5);
  document.getElementById('top-menu').innerHTML=top5.length
    ?top5.map(([n,d],i)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #c8e6dc;font-size:12px">
        <span style="width:20px;height:20px;background:${i===0?'#f0c419':i===1?'#c8e6dc':'#f0f0f0'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;color:#155f48;flex-shrink:0">${i+1}</span>
        <div style="flex:1"><div style="font-weight:600">${n}</div><div style="font-size:10px;color:#888">${d.cat}</div></div>
        <span style="color:#4a7a65;font-size:11px">${d.qty} sold</span>
        <strong style="color:#155f48;min-width:80px;text-align:right">${fmt(d.rev)}</strong>
      </div>`).join('')
    :'<div style="color:#9abfb2;font-style:italic;font-size:12px;padding:10px 0">No sales data yet</div>';

  // Today channel split
  const chSplit={};
  todayTx.forEach(t=>{chSplit[t.channel]=(chSplit[t.channel]||0)+t.total;});
  document.getElementById('cashflow-summary').innerHTML=`
    <div style="padding:4px 0">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #c8e6dc;font-size:13px">
        <span style="color:#4a7a65">↑ Revenue (Today)</span><strong style="color:#155f48">${fmt(todayRev)}</strong>
      </div>
      ${Object.entries(chSplit).map(([c,v])=>`
        <div style="display:flex;justify-content:space-between;padding:4px 0 4px 12px;font-size:11px;color:#888">
          <span><span class="badge ${chColors[c]||'ch-di'}">${c}</span></span><span>${fmt(v)}</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #c8e6dc;font-size:13px">
        <span style="color:#4a7a65">Expenses (Today)</span><strong style="color:#c0392b">${fmt(todayExpTot)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0 4px;border-top:2px solid #f0c419;font-size:14px;font-weight:800">
        <span>Net Profit</span>
        <strong style="color:${profit>=0?'#27ae60':'#c0392b'}">${fmt(profit)}</strong>
      </div>
    </div>`;

  // Recent activity
  const combined=[
    ...transactions.slice(0,6).map(t=>({...t,_rtype:'sale'})),
    ...expenses.slice(0,4).map(e=>({...e,_rtype:'expense'}))
  ].sort((a,b)=>b._ts-a._ts).slice(0,10);

  document.getElementById('recent-activity').innerHTML=combined.map(r=>
    r._rtype==='sale'?`
    <tr>
      <td style="color:#4a7a65;font-weight:700">#TX${r.id}</td>
      <td style="font-size:11px">${displayDateTimeEN(r.fullTime)}</td>
      <td><span class="badge" style="background:#EAF3DE;color:#3B6D11">SALE</span></td>
      <td style="font-size:11px">${r.items.slice(0,2).map(i=>i.name+'×'+i.qty).join(', ')}${r.items.length>2?` +${r.items.length-2} more`:''}</td>
      <td><span class="badge ${chColors[r.channel]||'ch-di'}">${r.channel}</span></td>
      <td><span class="badge ${payColors[r.payment]||'bq'}">${r.payment}</span></td>
      <td style="color:#155f48;font-weight:700">${fmt(r.total)}</td><td>—</td>
    </tr>`:
    `<tr>
      <td style="color:#c0392b;font-weight:700">#EX${r.id}</td>
      <td style="font-size:11px">${displayDateTimeEN(r.fullTime)}</td>
      <td><span class="badge" style="background:#fdecea;color:#c0392b">EXPENSE</span></td>
      <td style="font-size:11px">${r.description}</td>
      <td style="color:#888;font-size:11px">${r.category}</td>
      <td><span class="badge bt">${r.payment}</span></td>
      <td>—</td><td style="color:#c0392b;font-weight:700">${fmt(r.amount)}</td>
    </tr>`
  ).join('')||`<tr><td colspan="8" style="color:#9abfb2;font-style:italic;text-align:center;padding:20px">No activity yet</td></tr>`;
}

// ── HISTORY ──
// ── TODAY'S TRANSACTIONS (karyawan) ──
function renderTodayHistory() {
  const todayStr = today();
  document.getElementById('today-date-label').textContent = displayDateEN(todayStr);
  const btnPrint = (typeof t === 'function') ? t('btn.print') : 'Invoice';
  const btnVoid = (typeof t === 'function') ? t('btn.delete') : 'Void';

  const todayTx = transactions.filter(tx => tx.date === today());

  document.getElementById('today-history-body').innerHTML = todayTx.length
    ? todayTx.map(tx=>`
        <tr>
          <td style="color:#4a7a65;font-weight:700">#TX${tx.id}</td>
          <td style="font-size:11px">${tx.fullTime.split(',')[1]?.trim()||tx.fullTime}</td>
          <td style="font-weight:600">${tx.customer||'Walk-in'}</td>
          <td><span class="badge ${chColors[tx.channel]||'ch-di'}">${tx.channel}</span></td>
          <td style="font-size:11px;color:#4a7a65">${tx.items.slice(0,3).map(i=>i.name+' ×'+i.qty).join(', ')}${tx.items.length>3?` +${tx.items.length-3}`:''}</td>
          <td><span class="badge ${payColors[tx.payment]||'bq'}">${tx.payment}</span></td>
          <td><strong style="color:#155f48">${fmt(tx.total)}</strong></td>
          <td class="col-actions" style="white-space:nowrap">
            <button type="button" class="btn-page" onclick="printInvoice(${tx.id})">${btnPrint}</button>
            <button type="button" class="btn-row-delete" onclick="openDeleteModal('transaction',${tx.id},true)">${btnVoid}</button>
          </td>
        </tr>`).join('')
    : `<tr><td colspan="8" style="color:#9abfb2;font-style:italic;padding:20px;text-align:center">
        No transactions today yet
      </td></tr>`;

  const grandTotal = todayTx.reduce((s,t)=>s+t.total,0);
  document.getElementById('today-history-total').textContent =
    `${todayTx.length} transactions today — Total: ${fmt(grandTotal)}`;
}
function renderHistory() {
  const pay = document.getElementById('f-pay').value;
  const ch = document.getElementById('f-ch').value;
  const fromIso = document.getElementById('f-date-from')?.value || '';
  const toIso = document.getElementById('f-date-to')?.value || '';
  let f = transactions;
  if (pay !== 'all') f = f.filter(t => t.payment === pay);
  if (ch !== 'all') f = f.filter(t => t.channel === ch);
  f = f.filter(t => recordInDateRange(t.date, fromIso, toIso));
  if (!pagers.history) pagers.history = { page: 1 };
  const page = pagers.history.page;
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = f.slice(start, start + PAGE_SIZE);
  const body = document.getElementById('history-body');
  body.innerHTML = pageRows.map(t => `
    <tr>
      <td style="color:#4a7a65;font-weight:700">#TX${t.id}</td>
      <td style="font-size:11px">${displayDateTimeEN(t.fullTime)}</td>
      <td style="font-weight:600">${t.customer}</td>
      <td><span class="badge ${chColors[t.channel]||'ch-di'}">${t.channel}</span></td>
      <td style="font-size:11px;color:#4a7a65">${t.items.slice(0,3).map(i=>i.name+' ×'+i.qty).join(', ')}${t.items.length>3?` +${t.items.length-3}`:''}</td>
      <td><span class="badge ${payColors[t.payment]||'bq'}">${t.payment}</span></td>
      <td><strong style="color:#155f48">${fmt(t.total)}</strong></td>
      ${deleteActionCell('transaction', t.id)}
    </tr>`).join('') || nodata(8);
  const grand = f.reduce((s, t) => s + t.total, 0);
  renderPagination('history', 'history-pagination', f.length, 'renderHistory');
  const rangeTxt = fromIso || toIso
    ? ` · ${fromIso ? displayDateEN(isoToIdDate(fromIso)) : '…'} – ${toIso ? displayDateEN(isoToIdDate(toIso)) : '…'}`
    : '';
  document.getElementById('history-total').textContent =
    `Filtered total: ${fmt(grand)}${rangeTxt}`;
}

// ── EXPENSE LOG ──
function renderExpLog() {
  const cat = document.getElementById('ef-cat').value;
  const fromIso = document.getElementById('ef-date-from')?.value || '';
  const toIso = document.getElementById('ef-date-to')?.value || '';
  let f = expenses;
  if (cat !== 'all') f = f.filter(e => e.category === cat);
  f = f.filter(e => recordInDateRange(e.date, fromIso, toIso));
  if (!pagers.explog) pagers.explog = { page: 1 };
  const page = pagers.explog.page;
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = f.slice(start, start + PAGE_SIZE);
  document.getElementById('explog-body').innerHTML = pageRows.map(e => `
    <tr>
      <td style="color:#c0392b;font-weight:700">#EX${e.id}</td>
      <td style="font-size:11px">${displayDateTimeEN(e.fullTime)}</td>
      <td style="font-weight:600;color:#c0392b">${e.category}</td>
      <td style="font-size:11px">${e.description}</td>
      <td><span class="badge bt">${e.payment}</span></td>
      <td><strong style="color:#c0392b">${fmt(e.amount)}</strong></td>
      ${deleteActionCell('expense', e.id)}
    </tr>`).join('') || nodata(7);
  const grand = f.reduce((s, e) => s + e.amount, 0);
  renderPagination('explog', 'explog-pagination', f.length, 'renderExpLog');
  document.getElementById('explog-total').textContent = `Filtered total: ${fmt(grand)}`;
}

// ── RECONCILIATION ──
function renderRecon() {
  // Pre-fill statement date with today
  const dateInput = document.getElementById('recon-date');
  if(dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);
}

function runReconciliation() {
  const dateVal   = document.getElementById('recon-date').value;
  const bankBal   = parseFloat(document.getElementById('recon-bank-bal').value);

  if(!dateVal) { showToast('Please select a statement date', 'error'); return; }
  if(isNaN(bankBal)) { showToast('Please enter the bank statement balance', 'error'); return; }

  // Parse selected date to id-ID format for matching
  const d = new Date(dateVal);
  const dateStr = d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});

  // Transactions on that date
  const dayTx  = transactions.filter(t => t.date === dateStr);
  const dayExp = expenses.filter(e => e.date === dateStr);

  const qris     = dayTx.filter(t=>t.payment==='QRIS').reduce((s,t)=>s+t.total,0);
  const debit    = dayTx.filter(t=>t.payment==='Debit').reduce((s,t)=>s+t.total,0);
  const transfer = dayTx.filter(t=>t.payment==='Transfer').reduce((s,t)=>s+t.total,0);
  const totalInflow  = qris + debit + transfer;
  const totalOutflow = dayExp.reduce((s,e)=>s+e.amount,0);
  const systemBal    = totalInflow - totalOutflow;
  const diff         = bankBal - systemBal;

  const balanced = Math.abs(diff) < 1; // allow Rp 1 rounding

  const resultEl = document.getElementById('recon-result-panel');
  resultEl.style.display = 'block';

  resultEl.innerHTML = `
    <!-- Status Banner -->
    <div style="padding:16px 20px;border-radius:10px;margin-bottom:20px;
      background:${balanced?'#e8f5e9':'#fdecea'};
      border:2px solid ${balanced?'#4caf50':'#e53935'};
      display:flex;align-items:center;gap:12px">
      <span style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${balanced?'#2e7d32':'#c0392b'}">${balanced?'Balanced':'Variance'}</span>
      <div>
        <div style="font-size:15px;font-weight:800;color:${balanced?'#2e7d32':'#c0392b'}">
          ${balanced ? 'BALANCED — No Discrepancy Found' : 'DISCREPANCY DETECTED'}
        </div>
        <div style="font-size:12px;color:${balanced?'#388e3c':'#e53935'};margin-top:2px">
          ${balanced
            ? `System balance matches bank statement for ${dateStr}`
            : `Difference of ${fmt(Math.abs(diff))} — ${diff>0?'Bank balance HIGHER than system':'System balance HIGHER than bank'}`}
        </div>
      </div>
    </div>

    <!-- Detail breakdown -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- System side -->
      <div style="background:var(--teal-l);border:1px solid var(--teal-m);border-radius:10px;padding:16px">
        <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">
          📊 System Records — ${dateStr}
        </div>
        <div style="font-size:12px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--teal-m)">
            <span>Transactions recorded</span><strong>${dayTx.length} orders</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--teal-m)">
            <span><span class="badge bq">QRIS</span> receipts</span><strong style="color:#155f48">${fmt(qris)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--teal-m)">
            <span><span class="badge bd">Debit</span> receipts</span><strong style="color:#155f48">${fmt(debit)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--teal-m)">
            <span><span class="badge bt">Transfer</span> receipts</span><strong style="color:#155f48">${fmt(transfer)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--teal-m)">
            <span>Total Inflows</span><strong style="color:#155f48">${fmt(totalInflow)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--teal-m)">
            <span>Total Outflows (Expenses)</span><strong style="color:#c0392b">(${fmt(totalOutflow)})</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid var(--teal);margin-top:2px;font-size:13px;font-weight:900;color:var(--teal-d)">
            <span>System Net Balance</span><span>${fmt(systemBal)}</span>
          </div>
        </div>
      </div>

      <!-- Bank side -->
      <div style="background:var(--yellow-l);border:1px solid #e8d870;border-radius:10px;padding:16px">
        <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">
          🏦 Bank Statement — ${dateStr}
        </div>
        <div style="font-size:12px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e8d870">
            <span>Statement Date</span><strong>${dateStr}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e8d870">
            <span>Bank Statement Balance</span><strong style="color:#7a5e00;font-size:14px">${fmt(bankBal)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:8px;font-size:13px;font-weight:900;color:#7a5e00;border-top:2px solid var(--yellow)">
            <span>Bank Net Balance</span><span>${fmt(bankBal)}</span>
          </div>
        </div>

        <!-- Difference -->
        <div style="margin-top:16px;padding:12px;border-radius:8px;
          background:${balanced?'#e8f5e9':'#fdecea'};
          border:1px solid ${balanced?'#a5d6a7':'#f5c6cb'}">
          <div style="font-size:11px;font-weight:700;color:${balanced?'#2e7d32':'#c0392b'};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
            Difference
          </div>
          <div style="font-size:20px;font-weight:900;color:${balanced?'#2e7d32':'#c0392b'}">
            ${balanced ? 'Rp 0' : fmt(Math.abs(diff))}
          </div>
          <div style="font-size:11px;color:${balanced?'#388e3c':'#e53935'};margin-top:3px">
            ${balanced ? '✓ Accounts match' : (diff>0?'Bank > System — possible unrecorded inflow':'System > Bank — possible unrecorded expense')}
          </div>
        </div>
      </div>
    </div>

    <!-- Transactions on that day -->
    ${dayTx.length > 0 ? `
    <div class="sc" style="margin-bottom:0">
      <div class="st">Transaction Details — ${dateStr} (${dayTx.length} records)</div>
      <table>
        <thead><tr>
          <th>Ref #</th><th>Time</th><th>Customer</th>
          <th>Channel</th><th>Items</th><th>Payment</th><th>Amount</th>
        </tr></thead>
        <tbody>
          ${dayTx.slice(0,50).map(t=>`<tr>
            <td style="color:#4a7a65;font-weight:700">#TX${t.id}</td>
            <td style="font-size:11px">${t.fullTime}</td>
            <td style="font-weight:600">${t.customer}</td>
            <td><span class="badge ${chColors[t.channel]||'ch-di'}">${t.channel}</span></td>
            <td style="font-size:11px;color:#4a7a65">${t.items.slice(0,2).map(i=>i.name+' ×'+i.qty).join(', ')}${t.items.length>2?` +${t.items.length-2}`:''}</td>
            <td><span class="badge ${payColors[t.payment]||'bq'}">${t.payment}</span></td>
            <td><strong style="color:#155f48">${fmt(t.total)}</strong></td>
          </tr>`).join('')}
          ${dayTx.length>50?`<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:10px;font-style:italic">... and ${dayTx.length-50} more transactions</td></tr>`:''}
        </tbody>
      </table>
    </div>` : `<div style="text-align:center;padding:20px;color:var(--muted);font-style:italic">No transactions found for ${dateStr}</div>`}
  `;
}

// ── GENERAL LEDGER (BUKU BESAR) ──
function dateToMonthKey(dateStr) {
  if (!dateStr) return '';
  const raw = String(dateStr).split(',')[0].trim();
  const parts = raw.split(' ');
  if (parts.length < 3) return '';
  const year = parseInt(String(parts[2]).replace(/[^\d]/g, ''), 10);
  return year ? `${parts[1]} ${year}` : '';
}

function ledgerEligibleExpenses() {
  return expenses.filter(e =>
    e.payment !== 'Inventory' &&
    e.category !== 'Cost of Goods Sold' &&
    (OP_JOURNAL_CATS.includes(e.category) || (e.description || '').startsWith('AP Payment'))
  );
}

function filterLedgerEntries(list) {
  const monthVal = document.getElementById('jf-month')?.value || '';
  let fromIso = document.getElementById('jf-date-from')?.value || '';
  let toIso = document.getElementById('jf-date-to')?.value || '';
  const range = normalizeDateRange(fromIso, toIso);
  if (range.swapped && range.fromMs != null && range.toMs != null) {
    document.getElementById('jf-date-from').value = new Date(range.fromMs).toISOString().slice(0, 10);
    document.getElementById('jf-date-to').value = new Date(range.toMs).toISOString().slice(0, 10);
    fromIso = document.getElementById('jf-date-from').value;
    toIso = document.getElementById('jf-date-to').value;
  }
  if (fromIso || toIso) {
    return list.filter(e => recordInDateRange(e.date, fromIso, toIso));
  }
  if (monthVal) {
    const mk = monthInputToMonthKey(monthVal);
    return list.filter(e => dateToMonthKey(e.date) === mk);
  }
  return list;
}

function ledgerRowPair(r) {
  const da = expAcct[r.category] || r.category;
  const cr = expenseCreditAccount(r.payment);
  const tanggal = (r.fullTime || r.date || '').split(',')[0].trim() || r.date;
  const ket = `${r.description || '—'}<div class="ledger-ref">#EX${r.id}</div>`;
  return `<tr class="ledger-pair">
      <td rowspan="2" style="vertical-align:top;color:#4a7a65;font-size:11px;white-space:nowrap">${tanggal}</td>
      <td rowspan="2" class="ledger-desc">${ket}</td>
      <td style="font-weight:700;color:#c0392b">${da}</td>
      <td class="ledger-num dr">${fmtN(r.amount)}</td>
    </tr><tr class="ledger-pair ledger-pair-last">
      <td class="ledger-indent">${cr}</td>
      <td class="ledger-num cr">${fmtN(r.amount)}</td>
    </tr>`;
}

function renderJournal() {
  const rows = [];
  let opExpenses = filterLedgerEntries(ledgerEligibleExpenses())
    .map(e => ({ ...e, sk: e._ts || e.id * 2, kind: 'exp' }))
    .sort((a, b) => b.sk - a.sk);
  let manual = filterManualJournal(journalManual)
    .map(j => ({ ...j, sk: j._ts || 0, kind: 'manual' }))
    .sort((a, b) => b.sk - a.sk);
  const combined = [...opExpenses, ...manual].sort((a, b) => b.sk - a.sk);

  const sliceLimit = 800;
  combined.slice(0, sliceLimit).forEach(r => {
    rows.push(r.kind === 'manual' ? ledgerManualRowPair(r) : ledgerRowPair(r));
  });

  document.getElementById('journal-body').innerHTML = rows.join('') || nodata(4);
  const shown = Math.min(combined.length, sliceLimit);
  const totDr = combined.slice(0, sliceLimit).reduce((s, e) => s + e.amount, 0);
  document.getElementById('journal-totals').innerHTML =
    `<span>${shown} of ${combined.length} entries (expenses, AP payments, purchases)</span>
     <span>Total Debit: <strong>${fmt(totDr)}</strong></span>
     <span>Total Credit: <strong>${fmt(totDr)}</strong></span>
     <span style="color:#27ae60;font-weight:700">✓ Balanced</span>`;
}

// ── FINANCIAL REPORT ──
function renderReport() {
  const monthVal = document.getElementById('rep-month')?.value || '';
  const periodLabel = monthInputToLabel(monthVal);
  const periodEl = document.getElementById('rep-period-label');
  if (periodEl) {
    periodEl.textContent = monthVal
      ? `Income Statement — ${periodLabel} (monthly)`
      : 'Income Statement — All periods (cumulative totals)';
  }

  let repTx = filterByMonthInput(transactions, monthVal);
  let repExp = filterByMonthInput(expenses, monthVal);

  const mS={},pS={},cS={},expCatS={};
  const totRev=repTx.reduce((s,t)=>s+t.total,0);
  const totExp=repExp.reduce((s,e)=>s+e.amount,0);
  const netProfit=totRev-totExp;

  repTx.forEach(t=>{
    pS[t.payment]=pS[t.payment]||{count:0,total:0}; pS[t.payment].count++; pS[t.payment].total+=t.total;
    cS[t.channel]=cS[t.channel]||{count:0,total:0}; cS[t.channel].count++; cS[t.channel].total+=t.total;
    t.items.forEach(i=>{
      mS[i.name]=mS[i.name]||{cat:i.cat,qty:0,rev:0};
      mS[i.name].qty+=i.qty; mS[i.name].rev+=i.price*i.qty;
    });
  });
  repExp.forEach(e=>{
    expCatS[e.category]=expCatS[e.category]||{count:0,total:0};
    expCatS[e.category].count++; expCatS[e.category].total+=e.amount;
  });

  const cogs=(expCatS['Cost of Goods Sold']||{total:0}).total;
  const grossProfit=totRev-cogs;
  const opExp=totExp-cogs;

  document.getElementById('rep-income').innerHTML=`
    <tr style="background:#fdf6d8"><td colspan="2" style="font-weight:800;color:#155f48;padding:10px">▸ REVENUE</td><td></td></tr>
    <tr><td style="padding:8px 8px 8px 24px">Sales Revenue — All Channels</td><td style="color:#4a7a65">${repTx.length} transactions · ${periodLabel}</td><td style="font-weight:700;color:#155f48;text-align:right">${fmt(totRev)}</td></tr>
    <tr style="background:#fdf6d8"><td colspan="2" style="font-weight:800;color:#c0392b;padding:10px">▸ COST OF GOODS SOLD</td><td></td></tr>
    <tr><td style="padding:8px 8px 8px 24px">Raw Materials, Ingredients & Packaging</td><td style="color:#4a7a65">${(expCatS['Cost of Goods Sold']||{count:0}).count} entries</td><td style="color:#c0392b;text-align:right">(${fmt(cogs)})</td></tr>
    <tr style="border-top:2px solid #c8e6dc;background:#f8fdf9"><td colspan="2" style="font-weight:900;padding:10px">GROSS PROFIT</td><td style="font-weight:900;color:${grossProfit>=0?'#155f48':'#c0392b'};text-align:right;font-size:14px">${fmt(grossProfit)}</td></tr>
    <tr style="background:#fdf6d8"><td colspan="2" style="font-weight:800;color:#c0392b;padding:10px">▸ OPERATING EXPENSES</td><td></td></tr>
    ${['Salary Expense','Rent Expense','Utilities Expense','Marketing Expense','Maintenance Expense','Other Expense'].map(cat=>{
      const d=expCatS[cat]||{count:0,total:0};
      return d.total>0?`<tr><td style="padding:8px 8px 8px 24px">${cat}</td><td style="color:#4a7a65">${d.count} entries</td><td style="color:#c0392b;text-align:right">(${fmt(d.total)})</td></tr>`:'';
    }).join('')}
    <tr><td style="padding:8px 8px 8px 24px;color:#888">Total Operating Expenses</td><td></td><td style="color:#c0392b;text-align:right;font-weight:700">(${fmt(opExp)})</td></tr>
    <tr style="border-top:3px solid #f0c419;background:#fffdf0"><td colspan="2" style="font-weight:900;font-size:15px;padding:12px">NET PROFIT / (LOSS)</td><td style="font-weight:900;font-size:16px;color:${netProfit>=0?'#155f48':'#c0392b'};text-align:right">${fmt(netProfit)}</td></tr>`;

  document.getElementById('rep-menu').innerHTML=Object.entries(mS).sort((a,b)=>b[1].rev-a[1].rev).map(([n,d])=>
    `<tr><td style="font-weight:600">${n}</td><td><span style="font-size:10px;color:#888">${d.cat}</span></td><td>${d.qty}</td><td style="font-weight:700;color:#155f48;text-align:right">${fmt(d.rev)}</td></tr>`
  ).join('')||nodata(4);

  document.getElementById('rep-ch').innerHTML=Object.entries(cS).sort((a,b)=>b[1].total-a[1].total).map(([c,d])=>
    `<tr><td><span class="badge ${chColors[c]||'ch-di'}">${c}</span></td><td>${d.count}</td><td style="font-weight:700;text-align:right">${fmt(d.total)}</td><td>${pct(d.total,totRev)}</td></tr>`
  ).join('')||nodata(4);

  document.getElementById('rep-exp-cat').innerHTML=Object.entries(expCatS).sort((a,b)=>b[1].total-a[1].total).map(([c,d])=>
    `<tr><td style="font-weight:600;color:#c0392b">${c}</td><td>${d.count}</td><td style="font-weight:700;color:#c0392b;text-align:right">${fmt(d.total)}</td><td>${pct(d.total,totExp)}</td></tr>`
  ).join('')||nodata(4);

  document.getElementById('rep-pay').innerHTML=Object.entries(pS).map(([m,d])=>
    `<tr><td><span class="badge ${payColors[m]||'bq'}">${m}</span></td><td>${d.count}</td><td style="font-weight:700;text-align:right">${fmt(d.total)}</td><td>${pct(d.total,totRev)}</td></tr>`
  ).join('')||nodata(4);
}

// ── DAILY SALES REPORT ──
function renderDailyReport() {
  const selMonth   = document.getElementById('dr-month')?.value  || '';
  const selChannel = document.getElementById('dr-channel')?.value || 'all';
  const selPayment = document.getElementById('dr-payment')?.value || 'all';

  let filteredTx = transactions;
  if(selMonth)            filteredTx = filteredTx.filter(t=>dateToMonthKey(t.date)===monthInputToMonthKey(selMonth));
  if(selChannel!=='all')  filteredTx = filteredTx.filter(t=>t.channel===selChannel);
  if(selPayment!=='all')  filteredTx = filteredTx.filter(t=>t.payment===selPayment);

  // Build per-day summaries from filtered transactions
  const dayMap={};
  filteredTx.forEach(t=>{
    if(!dayMap[t.date]) dayMap[t.date]={date:t.date,rev:0,txCount:0,channels:{},payments:{}};
    dayMap[t.date].rev += t.total;
    dayMap[t.date].txCount++;
    dayMap[t.date].channels[t.channel]=(dayMap[t.date].channels[t.channel]||0)+t.total;
    dayMap[t.date].payments[t.payment]=(dayMap[t.date].payments[t.payment]||0)+t.total;
  });
  const days = Object.values(dayMap).sort((a,b)=>b.date.localeCompare(a.date));

  // Summary stats (based on filtered)
  const totalDays = days.length;
  const totalRev  = filteredTx.reduce((s,t)=>s+t.total,0);
  const avgRev    = totalDays ? totalRev/totalDays : 0;
  const bestDay   = days.reduce((a,b)=>a.rev>b.rev?a:b, days[0]||{rev:0,date:'—'});

  document.getElementById('dr-summary').innerHTML=`
    <div class="stat-card yellow-top"><div class="stat-label">Total Days</div><div class="stat-value">${totalDays}</div><div class="stat-sub">${selMonth ? monthInputToLabel(selMonth) : 'All time'}</div></div>
    <div class="stat-card green-top"><div class="stat-label">Total Revenue</div><div class="stat-value" style="font-size:18px">${fmt(totalRev)}</div><div class="stat-sub">${filteredTx.length} transactions</div></div>
    <div class="stat-card"><div class="stat-label">Avg Daily Revenue</div><div class="stat-value" style="font-size:18px">${fmt(avgRev)}</div><div class="stat-sub">per day</div></div>
    <div class="stat-card"><div class="stat-label">Best Day</div><div class="stat-value" style="font-size:18px">${fmt(bestDay.rev)}</div><div class="stat-sub">${bestDay.date}</div></div>`;

  // Daily summary table
  document.getElementById('dr-body').innerHTML = days.map(d=>`
    <tr style="cursor:pointer" onclick="toggleDayDetail('${d.date}')" title="Click to see transactions">
      <td style="font-weight:700;color:#155f48">${d.date} <span style="font-size:10px;color:var(--muted)">▼</span></td>
      <td style="font-weight:700">${d.txCount}</td>
      <td style="font-weight:700;color:#155f48">${fmt(d.rev)}</td>
      <td style="color:#4a7a65">${fmt(d.txCount?d.rev/d.txCount:0)}</td>
      <td style="font-size:11px">${Object.entries(d.channels).map(([c,v])=>`<span class="badge ${chColors[c]||'ch-di'}">${c}: ${fmt(v)}</span>`).join(' ')}</td>
      <td style="font-size:11px">${Object.entries(d.payments).map(([p,v])=>`<span class="badge ${payColors[p]||'bq'}">${p}: ${fmt(v)}</span>`).join(' ')}</td>
    </tr>
    <tr id="detail-${d.date.replace(/\s/g,'-')}" style="display:none">
      <td colspan="6" style="padding:0;background:#f8fcfa">
        <div style="padding:12px 16px">
          <div style="font-size:11px;font-weight:700;color:var(--teal-d);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
            Transaction Details — ${d.date}
          </div>
          <table style="width:100%;font-size:11px">
            <thead><tr style="background:var(--teal-l)">
              <th style="padding:6px 8px">Ref #</th>
              <th style="padding:6px 8px">Time</th>
              <th style="padding:6px 8px">Customer</th>
              <th style="padding:6px 8px">Channel</th>
              <th style="padding:6px 8px">Items</th>
              <th style="padding:6px 8px">Payment</th>
              <th style="padding:6px 8px;text-align:right">Amount</th>
            </tr></thead>
            <tbody>
              ${filteredTx.filter(t=>t.date===d.date).map(t=>`
                <tr style="border-bottom:1px solid #f0f5f3">
                  <td style="padding:5px 8px;color:#4a7a65;font-weight:700">#TX${t.id}</td>
                  <td style="padding:5px 8px;color:var(--muted)">${t.fullTime.split(', ')[1]||t.fullTime}</td>
                  <td style="padding:5px 8px;font-weight:600">${t.customer}</td>
                  <td style="padding:5px 8px"><span class="badge ${chColors[t.channel]||'ch-di'}">${t.channel}</span></td>
                  <td style="padding:5px 8px;color:#4a7a65">${t.items.slice(0,2).map(i=>i.name+' ×'+i.qty).join(', ')}${t.items.length>2?' +'+( t.items.length-2)+' more':''}</td>
                  <td style="padding:5px 8px"><span class="badge ${payColors[t.payment]||'bq'}">${t.payment}</span></td>
                  <td style="padding:5px 8px;font-weight:700;color:#155f48;text-align:right">${fmt(t.total)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </td>
    </tr>`).join('')||nodata(6);

  document.getElementById('dr-total').textContent=`Showing ${days.length} days · ${filteredTx.length} transactions`;
}

function toggleDayDetail(date) {
  const id = 'detail-'+date.replace(/\s/g,'-');
  const el = document.getElementById(id);
  if(el) el.style.display = el.style.display==='none' ? 'table-row' : 'none';
}

// ── EXPORTS ──
function exportCSV(type) {
  let csv='', filename='';
  const BOM='\uFEFF';

  if(type==='transactions'){
    filename=`só.ra_transactions_${new Date().toISOString().slice(0,10)}.csv`;
    csv=BOM+'Ref#,Date & Time,Customer,Channel,Items,Payment,Amount(Rp)\n';
    csv+=transactions.map(t=>`TX${t.id},"${t.fullTime}","${t.customer}","${t.channel}","${t.items.map(i=>i.name+' x'+i.qty).join(' | ')}","${t.payment}",${t.total}`).join('\n');
  } else if(type==='expenses'){
    filename=`só.ra_expenses_${new Date().toISOString().slice(0,10)}.csv`;
    csv=BOM+'Ref#,Date,Category,Description,Payment,Amount(Rp)\n';
    csv+=expenses.map(e=>`EX${e.id},"${e.fullTime}","${e.category}","${e.description}","${e.payment}",${e.amount}`).join('\n');
  } else if(type==='journal'){
    filename=`só.ra_general_ledger_${new Date().toISOString().slice(0,10)}.csv`;
    csv=BOM+'Tanggal,Keterangan,Debit(Rp),Kredit(Rp)\n';
    ledgerEligibleExpenses().forEach(e=>{
      const cr=expenseCreditAccount(e.payment);
      const tanggal=(e.fullTime||e.date||'').split(',')[0].trim();
      csv+=`"${tanggal}","${e.description} (#EX${e.id}) — ${expAcct[e.category]||e.category}",${e.amount},\n`;
      csv+=`"","${cr}",,${e.amount}\n`;
    });
  } else if(type==='daily'){
    filename=`só.ra_daily_sales_${new Date().toISOString().slice(0,10)}.csv`;
    csv=BOM+'Date,Transactions,Revenue(Rp),Avg Transaction(Rp)\n';
    const dayMap={};
    transactions.forEach(t=>{
      if(!dayMap[t.date]) dayMap[t.date]={rev:0,count:0};
      dayMap[t.date].rev+=t.total; dayMap[t.date].count++;
    });
    Object.entries(dayMap).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([d,v])=>{
      csv+=`"${d}",${v.count},${v.rev},${Math.round(v.rev/v.count)}\n`;
    });
  } else if(type==='report'){
    filename=`só.ra_income_statement_${new Date().toISOString().slice(0,10)}.csv`;
    const totRev=transactions.reduce((s,t)=>s+t.total,0);
    const expCatS={};
    expenses.forEach(e=>{expCatS[e.category]=(expCatS[e.category]||0)+e.amount;});
    const cogs=expCatS['Cost of Goods Sold']||0;
    const totExp=expenses.reduce((s,e)=>s+e.amount,0);
    csv=BOM+'INCOME STATEMENT — só.ra Coffee House\nAccount,Amount(Rp)\n';
    csv+=`Sales Revenue,${totRev}\nCost of Goods Sold,${cogs}\nGross Profit,${totRev-cogs}\n`;
    ['Salary Expense','Rent Expense','Utilities Expense','Marketing Expense','Maintenance Expense','Other Expense'].forEach(c=>{
      if(expCatS[c]) csv+=`${c},${expCatS[c]}\n`;
    });
    csv+=`Total Operating Expenses,${totExp-cogs}\nNet Profit,${totRev-totExp}\n`;
  }
  if(csv) downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}
function exportExcel(type) { exportCSV(type); }
function downloadFile(content, filename, mime) {
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
// MANUAL JOURNAL (purchases, etc.)
// ══════════════════════════════════════════════
let journalManual = JSON.parse(localStorage.getItem('só.ra_journal_manual') || '[]');
function saveJournalManual() {
  localStorage.setItem('só.ra_journal_manual', JSON.stringify(journalManual));
}
function addManualJournalEntry({ date, desc, debitAcct, creditAcct, amount, ref, _ts }) {
  journalManual.unshift({
    id: Date.now() + Math.random(),
    date: date || today(),
    desc,
    debitAcct,
    creditAcct,
    amount,
    ref: ref || '',
    _ts: _ts || Date.now(),
  });
  saveJournalManual();
}
function ledgerManualRowPair(j) {
  const tanggal = j.date;
  const ket = `${j.desc}<div class="ledger-ref">${j.ref || ''}</div>`;
  return `<tr class="ledger-pair">
      <td rowspan="2" style="vertical-align:top;color:#4a7a65;font-size:11px;white-space:nowrap">${tanggal}</td>
      <td rowspan="2" class="ledger-desc">${ket}</td>
      <td style="font-weight:700;color:#c0392b">${j.debitAcct}</td>
      <td class="ledger-num dr">${fmtN(j.amount)}</td>
    </tr><tr class="ledger-pair ledger-pair-last">
      <td class="ledger-indent">${j.creditAcct}</td>
      <td class="ledger-num cr">${fmtN(j.amount)}</td>
    </tr>`;
}
function filterManualJournal(list) {
  const monthVal = document.getElementById('jf-month')?.value || '';
  let fromIso = document.getElementById('jf-date-from')?.value || '';
  let toIso = document.getElementById('jf-date-to')?.value || '';
  if (fromIso || toIso) {
    return list.filter(e => recordInDateRange(e.date, fromIso, toIso));
  }
  if (monthVal) {
    const mk = monthInputToMonthKey(monthVal);
    return list.filter(e => dateToMonthKey(e.date) === mk);
  }
  return list;
}

// ══════════════════════════════════════════════
// INVOICE
// ══════════════════════════════════════════════
const INVOICE_COUNTER_KEY = 'só.ra_invoice_counter';
function nextInvoiceNumber() {
  let n = parseInt(localStorage.getItem(INVOICE_COUNTER_KEY) || '1000', 10);
  n += 1;
  localStorage.setItem(INVOICE_COUNTER_KEY, String(n));
  return `INV-${n}`;
}
function printInvoice(txId) {
  const tx = transactions.find(x => x.id === txId);
  if (!tx) { showToast('Transaction not found', 'error'); return; }
  const invNo = tx.invoiceNo || nextInvoiceNumber();
  if (!tx.invoiceNo) { tx.invoiceNo = invNo; fbSaveTransaction(tx); }
  const itemsHtml = tx.items.map(item => `
    <tr><td>${item.name}</td><td style="text-align:center">${item.qty}</td>
    <td style="text-align:right">${fmt(item.price * item.qty)}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>Invoice ${invNo}</title>
    <style>body{font-family:Arial,sans-serif;max-width:360px;margin:24px auto;font-size:12px}
    h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;margin:12px 0}
    td{padding:6px 4px;border-bottom:1px solid #eee}.total{font-weight:bold;font-size:14px}</style></head>
    <body>
    <h1>bé.ka Coffee &amp; Space</h1>
    <div style="color:#666;font-size:11px">Simple Invoice / Receipt</div>
    <p><strong>${invNo}</strong><br>Ref #TX${tx.id}<br>${tx.fullTime || tx.date}</p>
    <p>Customer: <strong>${tx.customer || 'Walk-in'}</strong><br>
    Channel: ${tx.channel || '—'} · Payment: ${tx.payment || '—'}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${itemsHtml}</tbody></table>
    <p class="total" style="text-align:right">TOTAL: ${fmt(tx.total)}</p>
    <p style="text-align:center;color:#888;margin-top:20px">Thank you!</p>
    </body></html>`;
  const w = window.open('', '', 'height=520,width=400');
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 300);
}
function printInvoiceFromReceipt() {
  if (window.currentReceipt) printInvoice(window.currentReceipt.id);
}

// ══════════════════════════════════════════════
// MARK PAID (AP) MODAL
// ══════════════════════════════════════════════
let pendingMarkPaidId = null;
function openMarkPaidModal(id) {
  const ap = payables.find(p => p.id === id);
  if (!ap) return;
  pendingMarkPaidId = id;
  document.getElementById('mark-paid-desc').textContent = `${ap.supplier} — ${ap.desc} · ${fmt(ap.amount)}`;
  document.getElementById('mp-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('mp-method').value = ap.paymentMethod || '';
  document.getElementById('mp-notes').value = ap.paymentNotes || '';
  document.getElementById('mark-paid-error').style.display = 'none';
  document.getElementById('mark-paid-modal').style.display = 'flex';
}
function closeMarkPaidModal() {
  document.getElementById('mark-paid-modal').style.display = 'none';
  pendingMarkPaidId = null;
}
function confirmMarkPaid() {
  if (pendingMarkPaidId == null) return;
  const ap = payables.find(p => p.id === pendingMarkPaidId);
  if (!ap) return;
  const payDateIso = document.getElementById('mp-date')?.value;
  const method = (document.getElementById('mp-method')?.value || '').trim();
  const notes = (document.getElementById('mp-notes')?.value || '').trim();
  const errEl = document.getElementById('mark-paid-error');
  if (!payDateIso) {
    errEl.textContent = 'Payment date is required.';
    errEl.style.display = 'block';
    return;
  }
  ap.status = 'paid';
  ap.paidDate = isoToIdDate(payDateIso);
  ap.rawPaid = payDateIso;
  ap.paymentMethod = method;
  ap.paymentNotes = notes;
  const proof = notes ? ` · ${notes}` : '';
  const methodPart = method ? ` via ${method}` : '';
  const catPart = (ap.desc || '').includes(':') ? ap.desc.split(':')[0].trim() : ap.desc;
  const expCat = OP_JOURNAL_CATS.includes(catPart) ? catPart : 'Other Expense';
  const payType = method.toLowerCase().includes('cash') ? 'Cash' : 'Transfer';
  const newExp = {
    id: expCounter++,
    fullTime: new Date(payDateIso + 'T12:00:00').toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    date: isoToIdDate(payDateIso),
    _ts: new Date(payDateIso + 'T12:00:00').getTime(),
    category: expCat,
    description: `AP Payment${methodPart}${proof} — ${ap.supplier}: ${ap.desc}`,
    amount: ap.amount,
    payment: payType,
  };
  expenses.unshift(newExp);
  fbSaveExpense(newExp);
  saveAPStorage();
  closeMarkPaidModal();
  renderPayable();
  renderJournal();
  showToast('✓ Paid — recorded in General Ledger');
}

// ══════════════════════════════════════════════
// MENU MANAGEMENT
// ══════════════════════════════════════════════
let menuEditRecipeId = null;
function loadMenuCatalog() {
  try {
    const raw = localStorage.getItem('só.ra_menu');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      menu.length = 0;
      parsed.forEach(m => menu.push(m));
      const seen = new Set();
      cats.length = 0;
      menu.forEach(m => { if (m.cat && !seen.has(m.cat)) { seen.add(m.cat); cats.push(m.cat); } });
    }
  } catch { /* keep seed menu */ }
}
function saveMenuCatalog() {
  localStorage.setItem('só.ra_menu', JSON.stringify(menu));
}
function loadMenuRecipesStorage() {
  try {
    const raw = localStorage.getItem('só.ra_menu_recipes');
    if (!raw || typeof menuRecipes === 'undefined') return;
    const saved = JSON.parse(raw);
    Object.keys(saved).forEach(k => { menuRecipes[k] = saved[k]; });
  } catch { /* ignore */ }
}
function saveMenuRecipesStorage() {
  if (typeof menuRecipes === 'undefined') return;
  localStorage.setItem('só.ra_menu_recipes', JSON.stringify(menuRecipes));
}
function nextMenuId() {
  return menu.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
}
function renderMenuManagement() {
  const body = document.getElementById('menu-mgmt-body');
  if (!body) return;
  const datalist = document.getElementById('menu-cat-list');
  if (datalist) datalist.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  body.innerHTML = menu.map(m => {
    const lines = getRecipeLines(m.id);
    const recipeLbl = lines.length ? `${lines.length} ingredient(s)` : 'No recipe';
    return `<tr>
      <td style="font-weight:700">${m.name}</td>
      <td>${m.cat}</td>
      <td>${fmt(m.price)}</td>
      <td style="font-size:11px;color:${lines.length ? '#155f48' : '#888'}">${recipeLbl}</td>
      <td style="white-space:nowrap">
        <button type="button" class="btn-page" onclick="editMenuRecipe(${m.id})">Recipe</button>
        <button type="button" class="btn-page" onclick="openMenuItemForm(${m.id})">Edit</button>
        <button type="button" class="btn-row-delete" onclick="deleteMenuItem(${m.id})">Del</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:#888;padding:16px">No menu items</td></tr>';
}
function openMenuItemForm(id) {
  document.getElementById('menu-item-modal').style.display = 'flex';
  document.getElementById('menu-edit-id').value = id || '';
  document.getElementById('menu-item-modal-title').textContent = id ? 'Edit Menu Item' : 'Add Menu Item';
  if (id) {
    const m = menu.find(x => x.id === id);
    document.getElementById('menu-form-name').value = m?.name || '';
    document.getElementById('menu-form-cat').value = m?.cat || '';
    document.getElementById('menu-form-price').value = m?.price || '';
  } else {
    document.getElementById('menu-form-name').value = '';
    document.getElementById('menu-form-cat').value = '';
    document.getElementById('menu-form-price').value = '';
  }
}
function closeMenuItemForm() {
  document.getElementById('menu-item-modal').style.display = 'none';
}
function saveMenuItemForm() {
  const idVal = document.getElementById('menu-edit-id').value;
  const name = document.getElementById('menu-form-name').value.trim();
  const cat = document.getElementById('menu-form-cat').value.trim();
  const price = parseFloat(document.getElementById('menu-form-price').value) || 0;
  if (!name || !cat || !price) { showToast('Name, category, and price required', 'error'); return; }
  if (idVal) {
    const m = menu.find(x => x.id === parseInt(idVal, 10));
    if (m) { m.name = name; m.cat = cat; m.price = price; }
  } else {
    menu.push({ id: nextMenuId(), name, cat, price });
    if (!cats.includes(cat)) cats.push(cat);
  }
  saveMenuCatalog();
  closeMenuItemForm();
  initCatFilters();
  renderMenuManagement();
  renderMenuGrid();
  showToast('Menu item saved');
}
function deleteMenuItem(id) {
  if (!confirm('Delete this menu item?')) return;
  const idx = menu.findIndex(m => m.id === id);
  if (idx >= 0) menu.splice(idx, 1);
  if (typeof menuRecipes !== 'undefined') delete menuRecipes[id];
  saveMenuCatalog();
  saveMenuRecipesStorage();
  renderMenuManagement();
  renderMenuGrid();
  showToast('Menu item removed');
}

function openRecipeBuilderForMenu(id) {
  const m = menu.find(x => x.id === id);
  if (!m) { showToast('Menu item not found', 'error'); return; }
  sp('menu-management');
  setTimeout(() => {
    editMenuRecipe(id);
    const panel = document.getElementById('menu-recipe-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Add recipe ingredients and stock, then click Save Recipe');
  }, 80);
}
function safeHtml(val) {
  return String(val ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function todayIdDate() {
  return new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}
function ensureInventoryFromRecipeLine(invName, unit, stockAdd, min, unitCost) {
  if (!invName) return null;
  let inv = inventoryItems.find(i => i.name.toLowerCase() === invName.toLowerCase());
  if (!inv) {
    inv = { id: Date.now() + Math.floor(Math.random()*10000), name: invName, cat: 'Raw Material', qty: 0, unit: unit || 'pcs', min: 0, unitCost: unitCost || 0, updated: todayIdDate() };
    inventoryItems.push(inv);
  }
  if (unit) inv.unit = unit;
  if (!Number.isNaN(min) && min >= 0) inv.min = min;
  if (!Number.isNaN(unitCost) && unitCost > 0) inv.unitCost = unitCost;
  if (stockAdd > 0) {
    inv.qty = (parseFloat(inv.qty) || 0) + stockAdd;
    inv.updated = todayIdDate();
  }
  return inv;
}
function editMenuRecipe(menuId) {
  menuEditRecipeId = menuId;
  const item = menu.find(m => m.id === menuId);
  document.getElementById('menu-recipe-hint').textContent = item ? `Recipe for: ${item.name}` : '';
  document.getElementById('menu-recipe-editor').style.display = 'block';
  renderRecipeLinesEditor();
}
function renderRecipeLinesEditor() {
  const wrap = document.getElementById('menu-recipe-lines');
  if (!wrap || menuEditRecipeId == null) return;
  const lines = getRecipeLines(menuEditRecipeId);
  const opts = inventoryItems.map(i => `<option value="${safeHtml(i.name)}">${safeHtml(i.name)}</option>`).join('');
  wrap.innerHTML = `
    <div style="font-size:11px;color:#4a7a65;margin-bottom:8px;line-height:1.45">
      Pilih ingredient yang sudah ada, atau ketik nama ingredient baru. Kalau isi <strong>Add Stock</strong>, stok akan otomatis masuk ke Stock & Inventory saat Save Recipe.
    </div>
    <div style="display:grid;grid-template-columns:1.2fr 80px 70px 90px 80px 90px 32px;gap:8px;margin-bottom:5px;font-size:10px;color:#4a7a65;font-weight:800">
      <div>Ingredient</div><div>Qty/Serving</div><div>Unit</div><div>Add Stock</div><div>Min Stock</div><div>Unit Cost</div><div></div>
    </div>` +
    (lines.length ? lines : [{ inv: '', qty: 0, unit: '', stockAdd: '', min: '', unitCost: '' }]).map((line, idx) => {
      const invRow = inventoryItems.find(i => i.name.toLowerCase() === String(line.inv || '').toLowerCase());
      return `<div style="display:grid;grid-template-columns:1.2fr 80px 70px 90px 80px 90px 32px;gap:8px;margin-bottom:8px;align-items:end">
        <div class="fg" style="margin:0">
          <input type="text" class="finput recipe-inv" data-idx="${idx}" list="inv-dl-recipe" value="${safeHtml(line.inv || '')}" placeholder="Ingredient name">
        </div>
        <input type="number" step="0.001" class="finput recipe-qty" data-idx="${idx}" value="${line.qty || ''}" placeholder="0.00">
        <input type="text" class="finput recipe-unit" data-idx="${idx}" value="${safeHtml(line.unit || invRow?.unit || '')}" placeholder="kg/ltr/pcs">
        <input type="number" step="0.001" class="finput recipe-stock" data-idx="${idx}" value="" placeholder="${invRow ? 'Add' : 'Initial'}">
        <input type="number" step="0.001" class="finput recipe-min" data-idx="${idx}" value="${invRow?.min ?? ''}" placeholder="Min">
        <input type="number" step="1" class="finput recipe-cost" data-idx="${idx}" value="${invRow?.unitCost ?? ''}" placeholder="Rp">
        <button type="button" onclick="removeRecipeLine(${idx})" style="border:none;background:#fdecea;color:#c0392b;border-radius:6px;cursor:pointer;height:36px">×</button>
      </div>`;
    }).join('') + `<datalist id="inv-dl-recipe">${opts}</datalist>`;
}
function addRecipeLine() {
  if (menuEditRecipeId == null) return;
  if (!menuRecipes[menuEditRecipeId]) menuRecipes[menuEditRecipeId] = [];
  menuRecipes[menuEditRecipeId].push({ inv: '', qty: 0, unit: '' });
  renderRecipeLinesEditor();
}
function removeRecipeLine(idx) {
  if (menuEditRecipeId == null || !menuRecipes[menuEditRecipeId]) return;
  menuRecipes[menuEditRecipeId].splice(idx, 1);
  renderRecipeLinesEditor();
}
function saveMenuRecipe() {
  if (menuEditRecipeId == null) return;
  const invInputs = document.querySelectorAll('#menu-recipe-lines .recipe-inv');
  const qtyInputs = document.querySelectorAll('#menu-recipe-lines .recipe-qty');
  const unitInputs = document.querySelectorAll('#menu-recipe-lines .recipe-unit');
  const stockInputs = document.querySelectorAll('#menu-recipe-lines .recipe-stock');
  const minInputs = document.querySelectorAll('#menu-recipe-lines .recipe-min');
  const costInputs = document.querySelectorAll('#menu-recipe-lines .recipe-cost');
  const lines = [];
  invInputs.forEach((inp, i) => {
    const inv = inp.value.trim();
    const qty = parseFloat(qtyInputs[i]?.value) || 0;
    const unit = (unitInputs[i]?.value || '').trim() || 'pcs';
    const stockAdd = parseFloat(stockInputs[i]?.value) || 0;
    const min = parseFloat(minInputs[i]?.value);
    const unitCost = parseFloat(costInputs[i]?.value);
    if (inv && qty > 0) {
      const invRow = ensureInventoryFromRecipeLine(inv, unit, stockAdd, Number.isNaN(min) ? 0 : min, Number.isNaN(unitCost) ? 0 : unitCost);
      lines.push({ inv: invRow?.name || inv, qty, unit: unit || invRow?.unit || '' });
    }
  });
  if (!lines.length) { showToast('Please add at least one ingredient with qty per serving', 'error'); return; }
  menuRecipes[menuEditRecipeId] = lines;
  saveMenuRecipesStorage();
  saveInvStorage();
  renderMenuManagement();
  renderMenuGrid();
  if (currentPage === 'inventory') renderInventory();
  showToast('✓ Recipe saved and inventory connected');
}

// ── STARTUP ──
const session = requireAuth();
if (session) {
  document.getElementById('topbar-date').textContent = formatTopbarDate();
  applySessionUI();
  initERPUI();
  if (typeof applyI18n === 'function') applyI18n();
  initApp().then(() => {
    pages.forEach(x => {
      const pg = document.getElementById('page-'+x);
      const nv = document.getElementById('nav-'+x);
      if(pg) pg.classList.add('hidden');
      if(nv) nv.classList.remove('active');
    });
    const startPage = isOwner ? 'dashboard' : 'sales';
    // Seed inventory defaults on first load
    if(inventoryItems.length === 0) {
      inventoryItems = [
        {id:1, name:'Coffee Beans',     cat:'Raw Material', qty:12, unit:'kg',   min:5,  unitCost:95000,  updated:'19 Mar 2026'},
        {id:2, name:'Fresh Milk',       cat:'Raw Material', qty:8,  unit:'liter',min:5,  unitCost:18000,  updated:'19 Mar 2026'},
        {id:3, name:'Sugar',            cat:'Raw Material', qty:6,  unit:'kg',   min:3,  unitCost:15000,  updated:'19 Mar 2026'},
        {id:4, name:'Cups (Hot)',       cat:'Packaging',    qty:200,unit:'pcs',  min:100,unitCost:500,    updated:'19 Mar 2026'},
        {id:5, name:'Cups (Cold)',      cat:'Packaging',    qty:180,unit:'pcs',  min:100,unitCost:600,    updated:'19 Mar 2026'},
        {id:6, name:'Straws',           cat:'Packaging',    qty:3,  unit:'pack', min:5,  unitCost:12000,  updated:'19 Mar 2026'},
        {id:7, name:'Chocolate Powder', cat:'Beverage Base',qty:4,  unit:'kg',   min:2,  unitCost:85000,  updated:'19 Mar 2026'},
        {id:8, name:'Matcha Powder',    cat:'Beverage Base',qty:1,  unit:'kg',   min:2,  unitCost:120000, updated:'19 Mar 2026'},
        {id:9, name:'Whipped Cream',    cat:'Beverage Base',qty:6,  unit:'can',  min:3,  unitCost:25000,  updated:'19 Mar 2026'},
        {id:10,name:'Paper Bags',       cat:'Packaging',    qty:50, unit:'pcs',  min:50, unitCost:800,    updated:'19 Mar 2026'},
      ];
      saveInvStorage();
    }
    // Seed payables defaults on first load
    if(payables.length === 0) {
      payables = [
        { id:1, supplier:'Pak Hendra', desc:'Coffee beans 10kg', amount:850000,
          invoiceDate:'15 Mei 2026', dueDate:'15 Jun 2026', rawDue:'2026-06-15', status:'unpaid', paidDate:null },
        { id:2, supplier:'PLN', desc:'Monthly electricity bill', amount:2100000,
          invoiceDate:'01 Mei 2026', dueDate:'20 Mei 2026', rawDue:'2026-05-20', status:'unpaid', paidDate:null },
      ];
      saveAPStorage();
    }
    if (!isOwner) seedStaffIncomingOrders();
    showIncomingOrdersAlert();
    sp(startPage);
  });
}

// ══════════════════════════════════════════════
// INVENTORY MODULE
// ══════════════════════════════════════════════

function updateInvCategoryHelp() {
  const el = document.getElementById('inv-cat-help');
  const sel = document.getElementById('inv-cat');
  if (!el || !sel) return;
  const help = typeof INV_CATEGORY_HELP !== 'undefined' ? INV_CATEGORY_HELP[sel.value] : '';
  el.textContent = help || '';
}

function addStockModal() {
  document.getElementById('inv-name').value = '';
  document.getElementById('inv-qty').value  = '';
  document.getElementById('inv-unit').value = '';
  document.getElementById('inv-min').value  = '';
  document.getElementById('inv-cat').value = 'Raw Material';
  updateInvCategoryHelp();
  document.getElementById('inv-modal').style.display = 'flex';
}

function saveInventoryItem() {
  const name = document.getElementById('inv-name').value.trim();
  const qty  = parseFloat(document.getElementById('inv-qty').value) || 0;
  const unit = document.getElementById('inv-unit').value.trim() || 'pcs';
  const min  = parseFloat(document.getElementById('inv-min').value) || 0;
  const cat  = document.getElementById('inv-cat').value;
  if(!name) { alert('Please enter item name'); return; }
  const existing = inventoryItems.find(i => i.name.toLowerCase() === name.toLowerCase());
  if(existing) {
    existing.qty = qty; existing.unit = unit; existing.min = min; existing.cat = cat;
    existing.updated = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  } else {
    inventoryItems.push({ id: Date.now(), name, cat, qty, unit, min,
      updated: new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) });
  }
  saveInvStorage();
  document.getElementById('inv-modal').style.display = 'none';
  renderInventory();
  showToast('✓ Inventory item saved');
}

function renderInventory() {
  const low = inventoryItems.filter(i => i.qty > 0 && i.qty <= i.min).length;
  const out = inventoryItems.filter(i => i.qty === 0).length;
  document.getElementById('inv-total-sku').textContent  = inventoryItems.length;
  document.getElementById('inv-low-stock').textContent  = low;
  document.getElementById('inv-out-stock').textContent  = out;

  document.getElementById('inventory-body').innerHTML = inventoryItems.map(i => {
    const status = i.qty === 0
      ? `<span class="badge" style="background:#fdecea;color:#c0392b">Out of Stock</span>`
      : i.qty <= i.min
      ? `<span class="badge" style="background:#fff3e0;color:#e65100">Low Stock</span>`
      : `<span class="badge" style="background:#e8f5e9;color:#2e7d32">In Stock</span>`;
    return `<tr>
      <td style="font-weight:700">${i.name}</td>
      <td><span style="font-size:10px;color:#888">${i.cat}</span></td>
      <td>${i.unit}</td>
      <td style="font-weight:700;color:${i.qty<=i.min?'#c0392b':'#155f48'}">${i.qty}</td>
      <td style="color:#888">${i.min}</td>
      <td>${status}</td>
      <td style="font-size:11px;color:#888">${i.updated}</td>
      <td><button onclick="editInvItem(${i.id})" style="padding:3px 10px;border-radius:5px;border:1.5px solid #c8e6dc;background:#fff;font-size:11px;cursor:pointer;color:#155f48">Edit</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:#888;padding:20px">No inventory items yet</td></tr>';
}

function editInvItem(id) {
  const item = inventoryItems.find(i => i.id === id);
  if(!item) return;
  document.getElementById('inv-name').value = item.name;
  document.getElementById('inv-qty').value  = item.qty;
  document.getElementById('inv-unit').value = item.unit;
  document.getElementById('inv-min').value  = item.min;
  document.getElementById('inv-cat').value  = item.cat;
  updateInvCategoryHelp();
  document.getElementById('inv-modal').style.display = 'flex';
}

// ══════════════════════════════════════════════
// PURCHASING MODULE
// ══════════════════════════════════════════════
function savePurchaseOrder() {
  const supplier = document.getElementById('po-supplier').value.trim();
  const item     = document.getElementById('po-item').value.trim();
  const qty      = parseFloat(document.getElementById('po-qty').value) || 0;
  const unit     = document.getElementById('po-unit').value.trim() || 'pcs';
  const amount   = parseFloat(document.getElementById('po-amount').value) || 0;
  const payment  = document.getElementById('po-payment').value;
  const date     = document.getElementById('po-date').value;
  if(!supplier || !item || !amount || !date) { alert('Please fill all fields'); return; }

  const po = { id: Date.now(), supplier, item, qty, unit, amount, payment,
    date: new Date(date).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}),
    rawDate: date };
  purchaseOrders.unshift(po);
  savePOStorage();

  // Update inventory if item matches
  const invMatch = inventoryItems.find(i => i.name.toLowerCase().includes(item.split(' ')[0].toLowerCase()));
  if(invMatch) { invMatch.qty += qty; invMatch.updated = po.date; saveInvStorage(); }

  const creditAcct = payment === 'Account Payable' ? 'Accounts Payable' : expenseCreditAccount(payment);
  addManualJournalEntry({
    date: po.date,
    desc: `Purchase — ${supplier}: ${item} (${qty} ${unit})`,
    debitAcct: 'Inventory',
    creditAcct,
    amount,
    ref: `#PO${po.id}`,
    _ts: new Date(date + 'T12:00:00').getTime(),
  });

  if (payment === 'Account Payable') {
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + 30);
    const dueIso = dueDate.toISOString().slice(0, 10);
    payables.push({
      id: Date.now() + 1, supplier, desc: item, amount,
      invoiceDate: po.date,
      dueDate: dueDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      rawDue: dueIso, rawInvoice: date,
      status: 'unpaid', paidDate: null,
    });
    saveAPStorage();
  }

  renderJournal();
  if (currentPage === 'report') renderReport();

  // Clear form
  ['po-supplier','po-item','po-qty','po-unit','po-amount'].forEach(id => document.getElementById(id).value = '');
  renderPurchasing();
  showToast('✓ Purchase order recorded');
}

function renderPurchasing() {
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('po-date').value = today;
  const listEl = document.getElementById('po-list');
  if(purchaseOrders.length === 0) { listEl.innerHTML = '<div style="color:#888;font-size:12px;padding:16px 0;text-align:center">No purchases recorded yet.</div>'; return; }
  listEl.innerHTML = purchaseOrders.slice(0,20).map(po => `
    <div style="padding:10px 0;border-bottom:1px solid #f0f5f3">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;font-size:12px">${po.item}</div>
          <div style="font-size:11px;color:#888">${po.supplier} · ${po.date} · ${po.qty} ${po.unit}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;color:#c0392b;font-size:12px">${fmt(po.amount)}</div>
          <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${po.payment==='Account Payable'?'#fdecea':'#e8f5e9'};color:${po.payment==='Account Payable'?'#c0392b':'#2e7d32'};font-weight:700">${po.payment}</span>
        </div>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════
// ACCOUNT PAYABLE MODULE
// ══════════════════════════════════════════════
function markPayablePaid(id) {
  openMarkPaidModal(id);
}

function renderPayable() {
  const today = new Date();
  const unpaid = payables.filter(p => p.status === 'unpaid');
  const paid   = payables.filter(p => p.status === 'paid');
  const overdue = unpaid.filter(p => p.rawDue && new Date(p.rawDue) < today).length;
  const paidAmt = paid.reduce((s,p) => s+p.amount, 0);
  const unpaidAmt = unpaid.reduce((s,p) => s+p.amount, 0);

  document.getElementById('ap-total').textContent   = fmt(unpaidAmt);
  document.getElementById('ap-overdue').textContent  = overdue;
  document.getElementById('ap-paid').textContent    = fmt(paidAmt);



  document.getElementById('payable-body').innerHTML = unpaid.length === 0
    ? '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px">No outstanding payables</td></tr>'
    : unpaid.map(p => {
      const isOverdue = p.rawDue && new Date(p.rawDue) < today;
      return `<tr style="background:${isOverdue?'#fff5f5':''}">
        <td style="font-weight:700">${p.supplier}</td>
        <td style="font-size:11px">${p.desc}</td>
        <td style="font-weight:700;color:#c0392b">${fmt(p.amount)}</td>
        <td style="font-size:11px;color:${isOverdue?'#c0392b':'#888'};font-weight:${isOverdue?'700':'400'}">${p.dueDate}${isOverdue?' ⚠':''}  </td>
        <td><span class="badge" style="background:${isOverdue?'#fdecea':'#fff3e0'};color:${isOverdue?'#c0392b':'#e65100'}">${isOverdue?'Overdue':'Unpaid'}</span></td>
        <td><button onclick="markPayablePaid(${p.id})" style="padding:4px 10px;border-radius:5px;border:1.5px solid #a5d6a7;background:#e8f5e9;font-size:11px;cursor:pointer;color:#2e7d32;font-weight:700">Mark Paid</button></td>
      </tr>`;
    }).join('');

  document.getElementById('payable-paid-body').innerHTML = paid.length === 0
    ? '<tr><td colspan="7" style="text-align:center;color:#888;padding:20px">No paid payables yet</td></tr>'
    : paid.map(p => {
      const detail = [p.paymentMethod, p.paymentNotes].filter(Boolean).join(' · ') || '—';
      return `<tr>
        <td style="font-weight:600">${p.supplier}</td>
        <td style="font-size:11px">${p.desc}</td>
        <td style="font-weight:700;color:#155f48">${fmt(p.amount)}</td>
        <td style="font-size:11px;color:#888">${p.invoiceDate}</td>
        <td style="font-size:11px;color:#888">${p.dueDate}</td>
        <td style="font-size:11px;color:#27ae60;font-weight:700">${p.paidDate}</td>
        <td style="font-size:11px;color:#4a7a65">${detail}</td>
      </tr>`;
    }).join('');
}

// ══════════════════════════════════════════════
// BALANCE SHEET MODULE
// ══════════════════════════════════════════════
function renderBalanceSheet() {
  const monthVal = document.getElementById('bs-month')?.value || '';
  const periodEl = document.getElementById('bs-period-label');

  let repTx  = transactions;
  let repExp = expenses;

  if(monthVal) {
    // filter by selected month
    const [yr, mo] = monthVal.split('-');
    repTx  = transactions.filter(t => { const d=new Date(t._ts||0); return d.getFullYear()==yr && (d.getMonth()+1)==parseInt(mo); });
    repExp = expenses.filter(e => { const d=new Date(e._ts||0); return d.getFullYear()==yr && (d.getMonth()+1)==parseInt(mo); });
    if(periodEl) periodEl.textContent = `Showing period: ${new Date(monthVal+'-01').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}`;
  } else {
    if(periodEl) periodEl.textContent = 'Showing: All periods (cumulative)';
  }

  const totRev = repTx.reduce((s, t) => s + t.total, 0);
  const cashOut = repExp.filter(e => e.payment !== 'Inventory').reduce((s, e) => s + e.amount, 0);
  const cogsTotal = repExp.filter(e => e.category === 'Cost of Goods Sold').reduce((s, e) => s + e.amount, 0);
  const opExpTotal = repExp.filter(e => OP_JOURNAL_CATS.includes(e.category)).reduce((s, e) => s + e.amount, 0);
  const netProfit = totRev - cogsTotal - opExpTotal;
  const cashBalance = totRev - cashOut;
  const unpaidAP = payables.filter(p => p.status === 'unpaid').reduce((s, p) => s + p.amount, 0);
  const avgCost = (typeof DEFAULT_INV_UNIT_COST !== 'undefined' ? DEFAULT_INV_UNIT_COST : 15000);

  const cashAsset = cashBalance;
  const inventoryVal = inventoryItems.reduce((s, i) => s + (i.qty * (i.unitCost != null ? i.unitCost : avgCost)), 0);
  const totalAssets = cashAsset + inventoryVal;

  const totalLiab = unpaidAP;
  const ownersEquity = totalAssets - totalLiab;
  const capital = 0;

  const cashColor = cashAsset >= 0 ? '#155f48' : '#c0392b';

  document.getElementById('bs-assets').innerHTML = `
    <tr style="background:#fdf6d8"><td colspan="3" style="font-weight:800;color:#27ae60;padding:10px">▸ CURRENT ASSETS</td></tr>
    <tr><td style="padding:8px 8px 8px 24px">Cash & Bank Balance</td><td style="color:#888;font-size:11px">Sales in − cash expenses paid</td><td style="text-align:right;font-weight:700;color:${cashColor}">${fmt(cashAsset)}</td></tr>
    <tr><td style="padding:8px 8px 8px 24px">Inventory</td><td style="color:#888;font-size:11px">${inventoryItems.length} SKU at unit cost</td><td style="text-align:right;font-weight:700;color:#155f48">${fmt(inventoryVal)}</td></tr>
    <tr style="border-top:2px solid #c8e6dc;background:#f8fdf9"><td colspan="2" style="font-weight:900;padding:10px">TOTAL ASSETS</td><td style="text-align:right;font-weight:900;color:#155f48;font-size:14px">${fmt(totalAssets)}</td></tr>`;

  document.getElementById('bs-liabilities').innerHTML = `
    <tr style="background:#fdf6d8"><td colspan="3" style="font-weight:800;color:#c0392b;padding:10px">▸ CURRENT LIABILITIES</td></tr>
    <tr><td style="padding:8px 8px 8px 24px">Accounts Payable</td><td style="color:#888;font-size:11px">${payables.filter(p=>p.status==='unpaid').length} unpaid · future scheduled payments</td><td style="text-align:right;font-weight:700;color:#c0392b">${fmt(totalLiab)}</td></tr>
    <tr style="border-top:2px solid #f5c6cb"><td colspan="2" style="font-weight:700;padding:8px 10px;color:#c0392b">Total Liabilities</td><td style="text-align:right;font-weight:700;color:#c0392b">${fmt(totalLiab)}</td></tr>
    <tr style="background:#fdf6d8"><td colspan="3" style="font-weight:800;color:#1565c0;padding:10px">▸ OWNER'S EQUITY</td></tr>
    <tr><td style="padding:8px 8px 8px 24px">Owner Capital</td><td style="color:#888;font-size:11px">Opening capital</td><td style="text-align:right;font-weight:700;color:#1565c0">${fmt(capital)}</td></tr>
    <tr><td style="padding:8px 8px 8px 24px">Retained Earnings</td><td style="color:#888;font-size:11px">Assets − Liabilities − Capital (period net ${fmt(netProfit)})</td><td style="text-align:right;font-weight:700;color:${ownersEquity>=0?'#1565c0':'#c0392b'}">${fmt(ownersEquity - capital)}</td></tr>
    <tr style="border-top:2px solid #90caf9"><td colspan="2" style="font-weight:700;padding:8px 10px;color:#1565c0">Total Equity</td><td style="text-align:right;font-weight:700;color:#1565c0">${fmt(ownersEquity)}</td></tr>
    <tr style="border-top:3px solid #c0392b;background:#fff5f5"><td colspan="2" style="font-weight:900;padding:10px">TOTAL LIABILITIES + EQUITY</td><td style="text-align:right;font-weight:900;color:#c0392b;font-size:14px">${fmt(totalLiab + ownersEquity)}</td></tr>`;

  const balanced = Math.abs(totalAssets - (totalLiab + ownersEquity)) < 1;
  document.getElementById('bs-check').innerHTML = balanced
    ? `<span style="color:#27ae60">✓ Balanced — Assets ${fmt(totalAssets)} = Liabilities ${fmt(totalLiab)} + Equity ${fmt(ownersEquity)}</span>`
    : `<span style="color:#c0392b">⚠ Unbalanced — Assets: ${fmt(totalAssets)} vs L+E: ${fmt(totalLiab + ownersEquity)}</span>`;
}
