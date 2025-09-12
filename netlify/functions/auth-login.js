const { loadUsers, saveUsers, hashPassword } = require('./_lib/users');

exports.handler = async function(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { username, password } = body || {};
    if (!username || !password) return { statusCode: 400, body: JSON.stringify({ error: 'username and password required' }) };
    const users = loadUsers();
    const user = users[username];
    if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'invalid credentials' }) };
    const { hash } = hashPassword(password, user.salt);
    if (hash !== user.hash) return { statusCode: 401, body: JSON.stringify({ error: 'invalid credentials' }) };
    const token = require('crypto').randomBytes(24).toString('hex');
    user.token = token;
    saveUsers(users);
    return { statusCode: 200, body: JSON.stringify({ username, token }) };
  } catch (err) {
    console.error('login err', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'login failed' }) };
  }
};
