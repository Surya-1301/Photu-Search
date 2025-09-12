// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
// ...existing code...
const USERS_FILE = path.join(__dirname, 'users.json');

// ...existing code...

// simple file-backed users store helpers
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '{}');
    }
  } catch (e) { console.error('loadUsers error', e); }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) { console.error('saveUsers error', e); }
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// CORS configuration
// In development allow requests from localhost/127.0.0.1 (convenience).
// In production, prefer an explicit CORS_ORIGIN environment variable.
const isDev = (process.env.NODE_ENV || '').trim() !== 'production';
let corsOptions;
if (isDev) {
  corsOptions = {
    origin: true, // reflect request origin, allowing localhost during dev
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  };
} else {
  corsOptions = {
    origin: process.env.CORS_ORIGIN || 'https://image-search-6h7egk594-surya-1301s-projects.vercel.app',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  };
}

app.use(cors(corsOptions));

app.use(express.json());

// In development, redirect non-API requests to the React dev server at :3000
// so the dev server's injected scripts and hot-reload are used. This is
// intentional for local development environments where `npm start` is running.
if (isDev) {
  app.use((req, res, next) => {
    const p = req.path || '';
    if (p.startsWith('/api') || p.startsWith('/auth') || p === '/test' || p.startsWith('/dashboard') || p.startsWith('/me')) return next();
    // Redirect browser to React dev server (assumes `npm start` is running on :3000)
    const devUrl = `http://localhost:3000${req.originalUrl || req.url}`;
    return res.redirect(devUrl);
  });
}

// Simple signup endpoint (returns JWT)
const JWT_SECRET = process.env.JWT_SECRET || process.env.REACT_APP_JWT_SECRET || 'change_this_dev_secret';
app.post('/auth/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const users = loadUsers();
  if (users[username]) return res.status(409).json({ error: 'user exists' });
  const { salt, hash } = hashPassword(password);
  users[username] = { salt, hash, createdAt: new Date().toISOString(), provider: 'local' };
  saveUsers(users);

  // Issue JWT
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ username, token });
});

// Simple login endpoint
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const users = loadUsers();
  const user = users[username];
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const { hash } = hashPassword(password, user.salt);
  if (hash !== user.hash) return res.status(401).json({ error: 'invalid credentials' });
  // Issue JWT
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ username, token });
});

// ...Google sign-in removed intentionally

// Owner-only dashboard endpoint. Access allowed if the request provides the
// ADMIN_TOKEN or the demo token of the owner user (matched by OWNER_EMAIL).
app.get('/dashboard', (req, res) => {
  const auth = req.get('authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();

  const ownerEmail = process.env.OWNER_EMAIL || process.env.REACT_APP_OWNER_EMAIL || null;

  // If ADMIN_TOKEN exists and matches, allow full dump
  if (process.env.ADMIN_TOKEN && bearer && bearer === process.env.ADMIN_TOKEN) {
    const users = loadUsers();
    const out = Object.keys(users).map(username => ({
      username,
      email: users[username].email || null,
      googleId: users[username].googleId || null,
      provider: users[username].provider || null,
      picture: users[username].picture || null,
      createdAt: users[username].createdAt
    }));
    return res.json({ usersCount: Object.keys(users).length, users: out });
  }

  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  try {
    const payload = jwt.verify(bearer, JWT_SECRET);
    const username = payload && payload.username;
    if (!username) return res.status(401).json({ error: 'unauthorized' });
    const users = loadUsers();
    // allow ownerEmail if configured
    if (ownerEmail && (users[username] && (users[username].email === ownerEmail || username === ownerEmail))) {
      const out = Object.keys(users).map(u => ({
        username: u,
        email: users[u].email || null,
        googleId: users[u].googleId || null,
        provider: users[u].provider || null,
        picture: users[u].picture || null,
        createdAt: users[u].createdAt
      }));
      return res.json({ usersCount: Object.keys(users).length, users: out });
    }
    return res.status(403).json({ error: 'forbidden' });
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
});

// Get current user by demo token
app.get('/me', (req, res) => {
  const auth = req.get('authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return res.status(401).json({ error: 'missing token' });

  try {
    const payload = jwt.verify(bearer, JWT_SECRET);
    const username = payload && payload.username;
    if (!username) return res.status(401).json({ error: 'invalid token' });

    const users = loadUsers();
    const found = users[username];
    if (!found) return res.status(401).json({ error: 'invalid token' });

    const safe = {
      username: username || null,
      email: found.email || null,
      googleId: found.googleId || null,
      provider: found.provider || null,
      picture: found.picture || null,
      createdAt: found.createdAt || null
    };
    res.json({ user: safe });
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Expose available provider configuration so frontend can adapt
app.get('/api/providers', (req, res) => {
  const providers = {
    unsplash: !!(process.env.UNSPLASH_ACCESS_KEY && String(process.env.UNSPLASH_ACCESS_KEY).trim()),
    pixabay: !!(process.env.PIXABAY_API_KEY && String(process.env.PIXABAY_API_KEY).trim()),
    pexels: !!(process.env.PEXELS_API_KEY && String(process.env.PEXELS_API_KEY).trim()),
    
  };
  res.json({ providers });
});

// Image search endpoint
app.get('/api/images', async (req, res) => {
  try {
    const { query, page = 1 } = req.query;
  // Enforce a configurable per-page cap so the UI can request more items when needed.
  const requestedPer = Number(req.query.per_page) || 20;
  const MAX_PER_PAGE = Number(process.env.MAX_PER_PAGE) || 500; // configurable via env, default 500
  const per = Math.min(isNaN(requestedPer) ? 20 : requestedPer, MAX_PER_PAGE);

    // Validate required params early and return clear 400 errors for clients
    if (!query || !String(query).trim()) {
      return res.status(400).json({ error: 'query parameter is required' });
    }
    // provider can be forced via ?provider=pixabay|unsplash|pinterest
    const providerParam = (req.query.provider || '').toLowerCase();
    // Resolve provider preference: query param overrides env flags
    let provider = 'unsplash';
    if (providerParam) provider = providerParam;
    else if (process.env.USE_PIXABAY === 'true') provider = 'pixabay';
    else if (process.env.USE_PINTEREST === 'true') provider = 'pinterest';

    // Normalize provider tokens (accept variants like 'both', 'pixabay+unsplash')
    const norm = (p) => (p || '').toLowerCase().replace(/\s+/g, '');
    const prov = norm(provider);

    // Helper to check availability of provider keys
    const hasUnsplash = !!(process.env.UNSPLASH_ACCESS_KEY && String(process.env.UNSPLASH_ACCESS_KEY).trim());
    const hasPixabay = !!(process.env.PIXABAY_API_KEY && String(process.env.PIXABAY_API_KEY).trim());
    const hasPexels = !!(process.env.PEXELS_API_KEY && String(process.env.PEXELS_API_KEY).trim());
    

    // If client asked for both but only one provider is configured, fall back to the available one.
    if (prov === 'both' || prov === 'pixabay+unsplash' || prov === 'unsplash+pixabay') {
      if (hasUnsplash && hasPixabay) {
        provider = 'both';
      } else if (hasUnsplash) {
        provider = 'unsplash';
      } else if (hasPixabay) {
        provider = 'pixabay';
      } else if (hasPexels) {
        provider = 'pexels';
      } else {
        return res.status(400).json({ error: 'No image providers configured (set UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY, or PEXELS_API_KEY).' });
      }
    }

    // If client requested a specific provider but it's not configured, try sensible fallbacks
    if (prov === 'pixabay' && !hasPixabay) {
      if (hasUnsplash) provider = 'unsplash';
      else if (hasPexels) provider = 'pexels';
      else return res.status(400).json({ error: 'PIXABAY_API_KEY is not configured; no fallback providers available.' });
    }
    if (prov === 'unsplash' && !hasUnsplash) {
      if (hasPixabay) provider = 'pixabay';
      else if (hasPexels) provider = 'pexels';
      else return res.status(400).json({ error: 'UNSPLASH_ACCESS_KEY is not configured; no fallback providers available.' });
    }
    if (prov === 'pexels' && !hasPexels) {
      if (hasUnsplash) provider = 'unsplash';
      else if (hasPixabay) provider = 'pixabay';
      else return res.status(400).json({ error: 'PEXELS_API_KEY is not configured; no fallback providers available.' });
    }

    console.log('Search query:', query, 'Page:', page, 'Provider:', provider);

  // Both branch: query multiple configured providers (Unsplash, Pixabay, Pexels)
    if (provider === 'both' || provider === 'pixabay+unsplash' || provider === 'unsplash+pixabay') {
      const requests = [];
      const meta = []; // track provider name for each promise

      const pixabayUrl = process.env.PIXABAY_API_URL || 'https://pixabay.com/api/';

      // Build provider requests only for configured providers. Distribute the
      // requested `per` across providers evenly (ceil) so combined results aim
      // to return up to `per` total items after interleaving/deduping.
  const providersCount = [hasUnsplash, hasPixabay, hasPexels].filter(Boolean).length || 1;
      const perProvider = Math.max(1, Math.ceil(per / providersCount));

      if (hasUnsplash) {
        requests.push(axios.get(`https://api.unsplash.com/search/photos`, {
          headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
          params: { query, page, per_page: perProvider }
        }));
        meta.push('unsplash');
      }
      if (hasPixabay) {
        requests.push(axios.get(pixabayUrl, {
          params: {
            key: process.env.PIXABAY_API_KEY,
            q: query,
            image_type: 'photo',
            per_page: perProvider,
            page
          }
        }));
        meta.push('pixabay');
      }
      if (hasPexels) {
        const pexelsUrl = process.env.PEXELS_API_URL || 'https://api.pexels.com/v1/search';
        requests.push(axios.get(pexelsUrl, {
          headers: { 'Authorization': process.env.PEXELS_API_KEY },
          params: { query, per_page: perProvider, page }
        }));
        meta.push('pexels');
      }
      

      if (requests.length === 0) {
        return res.status(400).json({ error: 'No image providers configured to satisfy provider=both. Set UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY, or PEXELS_API_KEY.' });
      }

      // Execute all configured provider requests in parallel. Use allSettled
      // so a failing provider doesn't cancel the whole combined result.
      const settled = await Promise.allSettled(requests);

      // Normalize results per provider
      const providerHits = {};
      for (let i = 0; i < settled.length; i++) {
        const which = meta[i];
        const item = settled[i];
        if (item.status !== 'fulfilled') {
          console.warn(`Provider ${which} request failed:`, (item.reason && (item.reason.response && item.reason.response.data)) || item.reason && item.reason.message || item.reason);
          continue;
        }
        const resp = item.value;
        if (which === 'unsplash') {
          const uResults = (resp.data && resp.data.results) || [];
          providerHits.unsplash = uResults.map(r => ({
            webformatURL: (r.urls && (r.urls.small || r.urls.regular || r.urls.full)) || '',
            tags: r.alt_description || r.description || '',
            likes: r.likes || 0,
            views: r.views || 0,
            user: (r.user && (r.user.username || r.user.name)) || '',
            provider: 'unsplash'
          }));
        } else if (which === 'pixabay') {
          const pResults = (resp.data && resp.data.hits) || [];
          providerHits.pixabay = pResults.map(p => ({
            webformatURL: p.webformatURL || p.previewURL || p.largeImageURL || '',
            tags: p.tags || '',
            likes: p.likes || 0,
            views: p.views || 0,
            user: p.user || '',
            provider: 'pixabay'
          }));
        } else if (which === 'pexels') {
          const photos = resp.data.photos || [];
          providerHits.pexels = photos.map(p => ({
            webformatURL: (p.src && (p.src.medium || p.src.large || p.src.original)) || '',
            tags: p.alt || p.photographer || '',
            likes: p.liked ? 1 : 0,
            views: 0,
            user: p.photographer || '',
            provider: 'pexels',
            url: p.url || ''
          }));
          }
      }

      // Log what we received per provider for debugging
      console.log('Combined provider fetch summary:', Object.keys(providerHits).map(k => ({ provider: k, hits: providerHits[k] ? providerHits[k].length : 0 })));

      // Interleave results from all configured providers (round-robin)
      const lists = Object.values(providerHits).filter(Boolean);
      const maxLen = lists.reduce((m, arr) => Math.max(m, arr.length), 0);
      const interleaved = [];
      for (let i = 0; i < maxLen; i++) {
        for (const arr of lists) {
          if (arr[i]) interleaved.push(arr[i]);
        }
      }

      // Deduplicate by webformatURL (fall back to user+tags if missing)
      const seen = new Set();
      const mergedUnique = [];
      for (const item of interleaved) {
        const key = (item.webformatURL || (item.user + '|' + item.tags)).trim();
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        mergedUnique.push(item);
      }

      // Limit to requested per-page count
      const limited = mergedUnique.slice(0, per);
      return res.json({ totalHits: mergedUnique.length, hits: limited });
    }

    // Pixabay branch
    if (provider === 'pixabay') {
      if (!process.env.PIXABAY_API_KEY) {
        return res.status(400).json({ error: 'PIXABAY_API_KEY is required when provider=pixabay' });
      }

      const pixabayUrl = process.env.PIXABAY_API_URL || 'https://pixabay.com/api/';
      console.log('Using Pixabay API at', pixabayUrl);

      const pixabayResp = await axios.get(pixabayUrl, {
        params: {
          key: process.env.PIXABAY_API_KEY,
          q: query,
          image_type: 'photo',
          per_page: per, // Use dynamic per_page value
          page
        }
      });

      console.log('Pixabay API response summary:', { total: pixabayResp.data.totalHits, hits: pixabayResp.data.hits && pixabayResp.data.hits.length });
      return res.json(pixabayResp.data);
    }

    // Pinterest branch
    if (provider === 'pinterest') {
      if (!process.env.PINTEREST_ACCESS_TOKEN) {
        return res.status(400).json({ error: 'PINTEREST_ACCESS_TOKEN is required when provider=pinterest' });
      }

      const pinterestUrl = process.env.PINTEREST_API_URL || 'https://api.pinterest.com/v5/search/pins';
      console.log('Using Pinterest API at', pinterestUrl);

      const pinterestResp = await axios.get(pinterestUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`,
          'Accept': 'application/json'
        },
        params: {
          query,
          page: page,
          page_size: 10
        }
      });

      console.log('Pinterest API response keys:', Object.keys(pinterestResp.data || {}));

      const items = pinterestResp.data.items || pinterestResp.data.results || pinterestResp.data.data || [];
      const hits = items.map(item => ({
        webformatURL:
          (item.images && (item.images.original && item.images.original.url)) ||
          item.image_url ||
          (item.media && item.media[0] && (item.media[0].url || item.media[0].src)) ||
          '',
        tags: item.description || item.title || item.alt_text || '',
        likes: item.reactions_count || item.like_count || 0,
        views: item.view_count || 0,
        user: (item.owner && (item.owner.username || item.owner.name)) || (item.creator && (item.creator.username || item.creator.name)) || ''
      }));

      return res.json({
        totalHits: pinterestResp.data.total || (pinterestResp.data.count || items.length),
        hits
      });
    }

      // Pexels branch
      if (provider === 'pexels') {
        if (!process.env.PEXELS_API_KEY) {
          return res.status(400).json({ error: 'PEXELS_API_KEY is required when provider=pexels. Set PEXELS_API_KEY in env.' });
        }

        const pexelsUrl = process.env.PEXELS_API_URL || 'https://api.pexels.com/v1/search';
        console.log('Using Pexels API at', pexelsUrl);

        const pexelsResp = await axios.get(pexelsUrl, {
          headers: {
            'Authorization': process.env.PEXELS_API_KEY
          },
          params: {
            query,
            per_page: per,
            page
          }
        });

        const photos = pexelsResp.data.photos || [];
        const hits = photos.map(p => ({
          id: p.id || (p.url && p.url.split('/').pop()),
          webformatURL: (p.src && (p.src.medium || p.src.large || p.src.original)) || '',
          largeImageURL: (p.src && (p.src.original || p.src.large)) || '',
          urls: p.src ? { regular: p.src.large, full: p.src.original } : undefined,
          tags: p.alt || p.photographer || '',
          likes: typeof p.likes === 'number' ? p.likes : (p.liked ? 1 : 0),
          views: typeof p.views === 'number' ? p.views : 0,
          user: p.photographer || '',
          provider: 'pexels',
          url: p.url || ''
        }));

        return res.json({ totalHits: pexelsResp.data.total_results || hits.length, hits });
      }

      

    // Default: Unsplash
    if (!process.env.UNSPLASH_ACCESS_KEY) {
      return res.status(400).json({ error: 'UNSPLASH_ACCESS_KEY is required for Unsplash provider' });
    }

    const unsplashResp = await axios.get(`https://api.unsplash.com/search/photos`, {
      headers: {
        'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
      },
      params: {
        query,
        page,
        per_page: 10
      }
    });

    console.log('Unsplash API response:', unsplashResp.data);
    const results = unsplashResp.data.results || [];
    const unsplashHits = results.map(r => ({
      webformatURL: (r.urls && (r.urls.small || r.urls.regular || r.urls.full)) || '',
      tags: r.alt_description || r.description || '',
      likes: r.likes || 0,
      views: r.views || 0,
      user: (r.user && (r.user.username || r.user.name)) || ''
    }));

    return res.json({
      totalHits: unsplashResp.data.total || results.length,
      hits: unsplashHits
    });
  } catch (error) {
    // Improve error reporting: if the failure is from axios upstream, forward
    // the upstream status and body when available so the client receives a
    // meaningful response instead of a generic 500 wrapper.
    if (error && error.isAxiosError) {
      if (error.response) {
        console.error('Upstream API error:', { status: error.response.status, data: error.response.data });
        const status = error.response.status || 500;
        const data = error.response.data || error.response.statusText || 'Upstream error';
        return res.status(status).json({ error: data });
      }
      // No response from upstream (network error / DNS / timeout)
      console.error('Upstream network error:', error.message);
      return res.status(502).json({ error: `Upstream network error: ${error.message || 'Network Error'}` });
    }

    console.error('Error fetching images:', error && error.message ? error.message : error);
    res.status(500).json({ error: error && error.message ? error.message : 'Internal server error' });
  }
});

// Add Pexels explicit provider handling earlier in the flow
// (we patch the handler above by adding branches before the default Unsplash block)


// If a frontend build exists at ../build, serve it as a static SPA.
// This allows deploying frontend and backend together on one server.
try {
  const buildPath = path.join(__dirname, '..', 'build');
  if (fs.existsSync(buildPath)) {
    console.log('Frontend build detected at', buildPath, '- enabling static file serving');
    app.use(express.static(buildPath));

    // Fallthrough for client-side routes: send index.html for non-API requests
    app.get('*', (req, res, next) => {
      // Let API/auth routes be handled above
      if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path === '/test' || req.path.startsWith('/dashboard') || req.path.startsWith('/me')) {
        return next();
      }
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  }
} catch (e) {
  console.warn('Error checking/serving build folder:', e && e.message);
}

// If no build is present, but there's a public folder (dev React apps), serve it.
try {
  const publicPath = path.join(__dirname, '..', 'public');
  const publicIndex = path.join(publicPath, 'index.html');
  if (!fs.existsSync(path.join(__dirname, '..', 'build')) && fs.existsSync(publicIndex)) {
  console.log('Serving frontend from public folder at', publicPath);
  // Prevent express.static from auto-serving index.html so our custom
  // GET / handler can replace %PUBLIC_URL% tokens first.
  app.use(express.static(publicPath, { index: false }));

    // Serve index.html but replace CRA placeholder `%PUBLIC_URL%` which
    // is only populated during a build. When serving the raw `public/index.html`
    // in development, the `%PUBLIC_URL%` tokens will produce requests like
    // `/%PUBLIC_URL%/manifest.json` which 404. Replace them with empty string.
    app.get('/', (req, res) => {
      try {
        let html = fs.readFileSync(publicIndex, 'utf8');
        html = html.replace(/%PUBLIC_URL%/g, '');
        res.set('Content-Type', 'text/html');
        return res.send(html);
      } catch (err) {
        console.warn('Could not inline public index, falling back to sendFile', err && err.message);
        return res.sendFile(publicIndex);
      }
    });
  }
} catch (e) {
  console.warn('Error checking/serving public folder:', e && e.message);
}

// Ensure root returns helpful JSON if no static frontend exists
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Photu Search backend is running. Use the frontend at / or the API at /api/images' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('CORS origin:', corsOptions.origin);
});
