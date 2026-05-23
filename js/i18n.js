// simple i18n (ID / EN)
const I18N = {
  id: {
    'nav.sales': 'Entri Penjualan',
    'nav.incoming': 'Pesanan Masuk',
    'nav.today': 'Transaksi Hari Ini',
    'nav.dashboard': 'Dasbor',
    'nav.history': 'Log Transaksi',
    'nav.expense': 'Entri Beban',
    'nav.explog': 'Log Beban',
    'nav.inventory': 'Stok & Inventori',
    'nav.purchasing': 'Pembelian',
    'nav.payable': 'Hutang Usaha',
    'nav.recon': 'Rekonsiliasi',
    'nav.journal': 'Buku Besar',
    'nav.deletion': 'Riwayat Hapus',
    'nav.daily': 'Laporan Harian',
    'nav.report': 'Laporan Keuangan',
    'nav.balance': 'Neraca',
    'nav.menu-mgmt': 'Kelola Menu',
    'role.owner': 'Pemilik',
    'role.staff': 'Karyawan',
    'btn.signout': 'Keluar',
    'btn.owner': 'Mode Pemilik',
    'btn.clear': 'Hapus filter',
    'btn.print': 'Cetak Invoice',
    'btn.markPaid': 'Tandai Lunas',
    'btn.delete': 'Hapus',
    'btn.confirm': 'Konfirmasi',
    'btn.cancel': 'Batal',
    'exp.cash': 'Tunai / bayar sekarang',
    'exp.credit': 'Hutang / bayar nanti (AP)',
    'pay.cash': 'Tunai',
    'pay.transfer': 'Transfer Bank',
    'pay.debit': 'Kartu Debit',
    'pay.ap': 'Hutang Usaha (bayar nanti)',
    'purchase.note': 'Tercatat di Buku Besar dan memperbarui inventori.',
    'lang.toggle': 'EN',
  },
  en: {
    'nav.sales': 'Sales Entry',
    'nav.incoming': 'Incoming Orders',
    'nav.today': "Today's Transactions",
    'nav.dashboard': 'Dashboard',
    'nav.history': 'Transaction Log',
    'nav.expense': 'Expense Entry',
    'nav.explog': 'Expense Log',
    'nav.inventory': 'Stock & Inventory',
    'nav.purchasing': 'Purchasing',
    'nav.payable': 'Account Payable',
    'nav.recon': 'Reconciliation',
    'nav.journal': 'General Ledger',
    'nav.deletion': 'Deletion History',
    'nav.daily': 'Daily Sales Report',
    'nav.report': 'Financial Report',
    'nav.balance': 'Balance Sheet',
    'nav.menu-mgmt': 'Menu Management',
    'role.owner': 'Owner',
    'role.staff': 'Staff',
    'btn.signout': 'Sign Out',
    'btn.owner': 'Switch to Owner',
    'btn.clear': 'Clear filter',
    'btn.print': 'Print Invoice',
    'btn.markPaid': 'Mark Paid',
    'btn.delete': 'Delete',
    'btn.confirm': 'Confirm',
    'btn.cancel': 'Cancel',
    'exp.cash': 'Cash / paid now',
    'exp.credit': 'On account / credit (AP)',
    'pay.cash': 'Cash',
    'pay.transfer': 'Bank Transfer',
    'pay.debit': 'Debit Card',
    'pay.ap': 'Account Payable (pay later)',
    'purchase.note': 'Recorded in General Ledger and updates inventory.',
    'lang.toggle': 'ID',
  },
};

const LANG_KEY = 'beka_lang';
let currentLang = localStorage.getItem(LANG_KEY) || 'id';

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en[key]) || key;
}

function setLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'id';
  localStorage.setItem(LANG_KEY, currentLang);
  applyI18n();
}

function toggleLanguage() {
  setLanguage(currentLang === 'id' ? 'en' : 'id');
}

function applyI18n() {
  document.documentElement.lang = currentLang === 'id' ? 'id' : 'en';
  const map = {
    'nav-sales': 'nav.sales',
    'nav-incoming-orders': 'nav.incoming',
    'nav-today-history': 'nav.today',
    'nav-dashboard': 'nav.dashboard',
    'nav-history': 'nav.history',
    'nav-expense': 'nav.expense',
    'nav-explog': 'nav.explog',
    'nav-inventory': 'nav.inventory',
    'nav-purchasing': 'nav.purchasing',
    'nav-payable': 'nav.payable',
    'nav-recon': 'nav.recon',
    'nav-journal': 'nav.journal',
    'nav-deletion-history': 'nav.deletion',
    'nav-daily': 'nav.daily',
    'nav-report': 'nav.report',
    'nav-balance-sheet': 'nav.balance',
    'nav-menu-mgmt': 'nav.menu-mgmt',
    'role-badge': null,
    'sign-out-btn': 'btn.signout',
    'elevate-owner-btn': 'btn.owner',
    'lang-toggle-btn': 'lang.toggle',
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el || !key) return;
    if (id === 'nav-incoming-orders') {
      const badge = document.getElementById('incoming-nav-badge');
      const badgeHtml = badge && badge.style.display !== 'none' ? ` <span id="incoming-nav-badge" class="nav-badge" style="display:inline-block">${badge.textContent}</span>` : '';
      el.innerHTML = t(key) + badgeHtml;
    } else {
      el.textContent = t(key);
    }
  });
  const rb = document.getElementById('role-badge');
  if (rb && typeof isOwner !== 'undefined') {
    rb.textContent = isOwner ? t('role.owner') : t('role.staff');
  }
  if (typeof currentPage !== 'undefined' && typeof sp === 'function') {
    const titles = {
      dashboard: 'nav.dashboard', sales: 'nav.sales', history: 'nav.history',
      'today-history': 'nav.today', expense: 'nav.expense', explog: 'nav.explog',
      recon: 'nav.recon', journal: 'nav.journal', report: 'nav.report',
      daily: 'nav.daily', 'deletion-history': 'nav.deletion',
      inventory: 'nav.inventory', purchasing: 'nav.purchasing',
      payable: 'nav.payable', 'balance-sheet': 'nav.balance',
      'menu-management': 'nav.menu-mgmt',
    };
    const titleKey = titles[currentPage];
    if (titleKey) {
      document.getElementById('topbar-title').textContent = t(titleKey);
    }
  }
}
