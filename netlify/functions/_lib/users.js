const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Store users under netlify/data/users.json (note: Netlify filesystem is ephemeral)
const DATA_DIR = path.join(process.cwd(), 'netlify', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('ensureDataDir error', e && e.message);
  }
}

function loadUsers() {
  try {
    ensureDataDir();
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8') || '{}';
      return JSON.parse(raw || '{}');
    }
  } catch (e) {
    console.warn('loadUsers error', e && e.message);
  }
  return {};
}

function saveUsers(users) {
  try {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.warn('saveUsers error', e && e.message);
  }
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

module.exports = { loadUsers, saveUsers, hashPassword };
