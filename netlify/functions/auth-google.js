const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { loadUsers, saveUsers } = require('./_lib/users');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || null;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

exports.handler = async function(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const id_token = body && (body.id_token || body.idToken || body.id_token);
    if (!id_token) return { statusCode: 400, body: JSON.stringify({ error: 'id_token is required' }) };

    let payload = null;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: id_token, audience: GOOGLE_CLIENT_ID || undefined });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      try {
        const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`;
        const gresp = await axios.get(verifyUrl);
        payload = gresp.data || null;
      } catch (tokeninfoErr) {
        console.error('google verify failed', tokeninfoErr && tokeninfoErr.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to verify Google token' }) };
      }
    }

    if (!payload || !payload.sub) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid Google token payload' }) };

    const email = payload.email || null;
    const users = loadUsers();
    const usernameKey = email || payload.sub;
    const now = new Date().toISOString();
    const token = require('crypto').randomBytes(24).toString('hex');

    users[usernameKey] = {
      username: payload.name || (email || payload.sub),
      email: email,
      googleId: payload.sub,
      picture: payload.picture || null,
      provider: 'google',
      createdAt: users[usernameKey] && users[usernameKey].createdAt ? users[usernameKey].createdAt : now,
      token
    };
    saveUsers(users);
    return { statusCode: 200, body: JSON.stringify({ username: users[usernameKey].username, email: users[usernameKey].email, token }) };
  } catch (err) {
    console.error('auth-google error', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'google sign-in failed' }) };
  }
};
