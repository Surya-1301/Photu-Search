const { loadUsers, saveUsers, hashPassword } = require('./_lib/users');

exports.handler = async function(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { username, password } = body || {};
    if (!username || !password) return { statusCode: 400, body: JSON.stringify({ error: 'username and password required' }) };
    const users = loadUsers();
    if (users[username]) return { statusCode: 409, body: JSON.stringify({ error: 'user exists' }) };
    const { salt, hash } = hashPassword(password);
    const token = require('crypto').randomBytes(24).toString('hex');
    users[username] = { salt, hash, createdAt: new Date().toISOString(), token };
    saveUsers(users);
    return { statusCode: 200, body: JSON.stringify({ username, token }) };
  } catch (err) {
    console.error('signup err', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'signup failed' }) };
  }
};
