const { loadUsers } = require('./_lib/users');

exports.handler = async function(event) {
  try {
    const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'missing token' }) };
    const users = loadUsers();
    const found = Object.keys(users).map(k => users[k]).find(u => u && u.token === token);
    if (!found) return { statusCode: 401, body: JSON.stringify({ error: 'invalid token' }) };
    const safe = {
      username: found.username || null,
      email: found.email || null,
      googleId: found.googleId || null,
      provider: found.provider || null,
      picture: found.picture || null,
      createdAt: found.createdAt || null
    };
    return { statusCode: 200, body: JSON.stringify({ user: safe }) };
  } catch (err) {
    console.error('me err', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'me failed' }) };
  }
};
