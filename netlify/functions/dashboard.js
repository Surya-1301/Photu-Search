const { loadUsers } = require('./_lib/users');

exports.handler = async function(event) {
  try {
    const authHeader = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const ownerEmail = process.env.OWNER_EMAIL || process.env.REACT_APP_OWNER_EMAIL || null;

    // ADMIN_TOKEN bypass
    if (process.env.ADMIN_TOKEN && token && token === process.env.ADMIN_TOKEN) {
      const users = loadUsers();
      const out = Object.keys(users).map(username => ({
        username,
        email: users[username].email || null,
        googleId: users[username].googleId || null,
        provider: users[username].provider || null,
        picture: users[username].picture || null,
        createdAt: users[username].createdAt,
        token: users[username].token || null
      }));
      return { statusCode: 200, body: JSON.stringify({ usersCount: Object.keys(users).length, users: out }) };
    }

    if (ownerEmail && token) {
      const users = loadUsers();
      const found = Object.keys(users).map(k => users[k]).find(u => u && u.token === token && (u.email === ownerEmail || u.username === ownerEmail));
      if (found) {
        const out = Object.keys(users).map(username => ({
          username,
          email: users[username].email || null,
          googleId: users[username].googleId || null,
          provider: users[username].provider || null,
          picture: users[username].picture || null,
          createdAt: users[username].createdAt,
          token: users[username].token || null
        }));
        return { statusCode: 200, body: JSON.stringify({ usersCount: Object.keys(users).length, users: out }) };
      }
    }

    return { statusCode: 401, body: JSON.stringify({ error: 'unauthorized' }) };
  } catch (err) {
    console.error('dashboard err', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'dashboard failed' }) };
  }
};
