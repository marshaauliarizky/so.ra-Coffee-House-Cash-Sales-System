// só.ra AIS — Session authentication
const OWNER_PASSWORD = 'admin123';
const SESSION_KEY = 'sora_ais_session';

function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, at: Date.now() }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function requireAuth() {
  const s = getSession();
  if (!s) {
    window.location.href = 'login.html';
    return null;
  }
  return s;
}

function isOwnerSession() {
  return getSession()?.role === 'owner';
}
