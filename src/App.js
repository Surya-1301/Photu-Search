// src/App.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { ReactComponent as Logo } from './logo.svg';
import './App.css'; // Optional: Import the CSS file for styling

function App() {
  // ...existing code...

  const [query, setQuery] = useState(''); // State to hold the search query
  const [images, setImages] = useState([]); // State to hold images fetched from the API
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('both');
  // Unsplash controls (only value used; setters intentionally omitted to avoid unused-vars)
  const [unsplashPerPage] = useState(10);
  const [unsplashOrientation] = useState('');
  const [unsplashColor] = useState('');
  // Pixabay controls (only value used; setters intentionally omitted to avoid unused-vars)
  const [pixabayPerPage] = useState(20);
  const [pixabayImageType] = useState('photo');
  const [pixabayOrder] = useState('popular');
  const [pixabayCategory] = useState('');
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [savingIds, setSavingIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());
  const [auth, setAuth] = useState({ token: null, username: null });
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // or signup
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [pendingSave, setPendingSave] = useState(null);
  const [toast, setToast] = useState(null);
  
  // API base: use REACT_APP_BACKEND_URL when set, otherwise use localhost backend during development
  const defaultLocal = 'http://localhost:10000';
  // Prefer explicit REACT_APP_BACKEND_URL. In development use localhost backend; otherwise
  // default to the current origin so fetches like `${apiBase}/api/...` resolve correctly.
  const apiBase = (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL.replace(/\/$/, ''))
    || ((typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ? defaultLocal : (typeof window !== 'undefined' ? window.location.origin : ''));

  // Save / download image (used by UI and by Google flow resume)
  const handleSave = useCallback(async (image, e) => {
    e && e.stopPropagation();
    // require authentication to save/download images
    const token = auth.token || localStorage.getItem('token');
    if (!token) {
      // store pending image and open auth modal
      setPendingSave(image);
      const pref = localStorage.getItem('preferredAuthMode') || 'signup';
      setAuthMode(pref);
      setShowAuth(true);
      return;
    }
    const key = image.webformatURL || image.largeImageURL || image.url || image.id || image.tags;
    if (!key) return;
    // already saving
    setSavingIds(prev => {
      const s = new Set(prev);
      if (s.has(key)) return prev;
      s.add(key);
      return s;
    });

    try {
      // fetch image as blob to ensure download works across origins
      const res = await fetch(image.webformatURL || image.largeImageURL || image.url);
      if (!res.ok) {
        const text = await res.text().catch(() => 'no body');
        throw new Error(`Failed to fetch image: ${res.status} ${res.statusText} - ${text}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (image.user || 'image').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      a.download = `${safeName}_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // persist minimal favorite info
      const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
      favs.push({ url: image.webformatURL || image.largeImageURL || image.url, tags: image.tags, user: image.user, provider: image.provider });
      localStorage.setItem('favorites', JSON.stringify(favs));

      setSavedIds(prev => {
        const s = new Set(prev);
        s.add(key);
        return s;
      });
    } catch (err) {
      console.error('Save/download failed', err);
      setToast((err && err.message) ? `Save failed: ${err.message}` : 'Save failed');
    } finally {
      setSavingIds(prev => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  }, [auth]);
  // Pagination / results
  const [page, setPage] = useState(1);
  const [totalHits, setTotalHits] = useState(null);
  // Lightbox / image expand state
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Google sign-in removed from client intentionally

  // update the browser tab title based on the query and provider
  useEffect(() => {
    const base = 'Photu Search | R3TiR3D';
    const parts = [];
    if (query && query.trim()) parts.push(query.trim());
    if (provider && provider !== 'both') parts.push(provider);
    document.title = parts.length ? `${base} — ${parts.join(' · ')}` : base;
    return () => { /* no cleanup needed */ };
  }, [query, provider]);

  

  // Show a helpful banner when no backend is configured and we're not on localhost
  const showBackendHint = !process.env.REACT_APP_BACKEND_URL && (typeof window !== 'undefined') && !(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && !apiBase;

  // ref for the search input so we can focus it when returning home
  const inputRef = useRef(null);

  const handleTitleClick = (e) => {
    // if user holds Ctrl (or Cmd on mac) do a full page reload
    if (e.ctrlKey || e.metaKey) {
      window.location.reload();
      return;
    }

    // otherwise reset to home: clear query and images and focus the input
    setQuery('');
    setImages([]);
    setError(null);
    setProvider('both');
    setLoadedImages(new Set());
    // scroll to top and focus the search input
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (inputRef.current) inputRef.current.focus();
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTitleClick(e);
    }
  };

  const handleImageLoad = (i) => {
    setLoadedImages(prev => {
      const s = new Set(prev);
      s.add(i);
      return s;
    });
  };

  // load saved ids from localStorage on mount
  useEffect(() => {
    try {
      const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
      const s = new Set(favs.map(f => f.url));
      setSavedIds(s);
    } catch (e) {
      // ignore
    }
  }, []);

  // load auth token
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username');
      const email = localStorage.getItem('email');
      if (token && username) {
        setAuth({ token, username, email });
        try { axios.defaults.headers.common['Authorization'] = `Bearer ${token}`; } catch (e) {}
      }
    } catch (e) {}
  }, []);

  // If we have a token, validate it with the backend and refresh user info
  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    if (!token) return;

    (async () => {
      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const resp = await axios.get(`${apiBase}/me`);
        if (!mounted) return;
        const user = resp.data && resp.data.user;
        if (user) {
            setAuth(prev => ({ token, username: user.username || prev.username, email: user.email || prev.email }));
            localStorage.setItem('username', user.username || '');
            if (user.email) localStorage.setItem('email', user.email);
        }
      } catch (err) {
        // token invalid or network error: clear stored token to force re-auth
        console.warn('Token validation failed:', err && err.response ? err.response.data : err.message || err);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        if (mounted) setAuth({ token: null, username: null });
      }
    })();

    return () => { mounted = false; };
  }, [apiBase]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const url = `${apiBase}/auth/${authMode}`;
      const resp = await axios.post(url, { username: authForm.username, password: authForm.password });
      const { token, username } = resp.data;
      setAuth({ token, username });
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      try { axios.defaults.headers.common['Authorization'] = `Bearer ${token}`; } catch (e) {}

  const successText = authMode === 'signup' ? 'Account created and signed in' : 'Signed in successfully';
  setToast(successText);
      setTimeout(() => setToast(null), 2500);
      setShowAuth(false);

      // resume pending save if present
      if (pendingSave) {
        setToast('Saving image after sign-in...');
        setTimeout(() => {
          try { handleSave(pendingSave, null); } catch (err) { console.warn('resumed save failed', err); }
          setPendingSave(null);
        }, 200);
        setTimeout(() => setToast(null), 2000);
      }
    } catch (err) {
      const serverMsg = err && err.response && err.response.data && (err.response.data.error || err.response.data.message);
      const msg = serverMsg || (err && err.message) || 'Authentication failed';
      setToast(msg);
      setTimeout(() => setToast(null), 2500);
    } finally {
      setAuthLoading(false);
    }
  };

  // Clear auth modal state when opened
  useEffect(() => {
    if (showAuth) {
      // clear any previous toast when opening the auth modal
      setToast(null);
      // Keep username if previously set, but clear password
      setAuthForm(prev => ({ username: prev.username || '', password: '' }));
    }
  }, [showAuth]);

  // UI display: show 15 items per page. Fetch a larger batch from backend
  // (controlled by REACT_APP_FETCH_SIZE, default 200) so we can paginate locally.
  const perPage = 15;
  const fetchSize = Number(process.env.REACT_APP_FETCH_SIZE) || 200;

  // Fetch results for a given page (used for search and pagination)
  const fetchResults = async (pageToFetch = 1) => {
    if (!query || !query.trim()) return;
    try {
      setLoading(true);
      setError(null);

    const params = new URLSearchParams();
    // Ensure we build a correct absolute or relative URL. If `apiBase` is set use
    // it as the origin (without trailing slash); otherwise fall back to a relative path.
    const backendBase = apiBase ? apiBase.replace(/\/$/, '') : '';
      params.set('query', query);
      params.set('provider', provider);
      params.set('page', String(pageToFetch));
  // enforce fixed per-page
  // Request a larger batch from backend (capped by backend MAX_PER_PAGE),
  // then we'll slice to show `perPage` items in the UI.
  params.set('per_page', String(fetchSize));

      // Unsplash params
      if (provider === 'unsplash' || provider === 'both') {
        if (unsplashPerPage) params.set('per_page', String(unsplashPerPage));
        if (unsplashOrientation) params.set('orientation', unsplashOrientation);
        if (unsplashColor) params.set('color', unsplashColor);
      }

      // Pixabay params
      if (provider === 'pixabay' || provider === 'both') {
        if (pixabayPerPage) params.set('per_page', String(pixabayPerPage));
        if (pixabayImageType) params.set('image_type', pixabayImageType);
        if (pixabayOrder) params.set('order', pixabayOrder);
        if (pixabayCategory) params.set('category', pixabayCategory);
      }

  const url = backendBase ? `${backendBase}/api/images?${params.toString()}` : `/api/images?${params.toString()}`;
      let response;
      try {
        response = await axios.get(url);
      } catch (axErr) {
        // axios error: include status and server body if available
        const status = axErr.response ? axErr.response.status : 'network';
        const body = axErr.response && axErr.response.data ? JSON.stringify(axErr.response.data) : (axErr.message || 'no body');
        let msg = `Request failed: ${status} - ${body}`;
        // If it's a network-level error (no response), provide a helpful hint
        if (!axErr.response) {
          msg = `Request failed: network - ${axErr.message || 'Network Error'} (tried: ${url}).\nEnsure the backend is running and reachable, or set REACT_APP_BACKEND_URL to your API host.`;
        }
        console.error(msg, axErr);
        setError(msg);
        setImages([]);
        setLoading(false);
        return;
      }
  const data = response.data || {};
  const allHits = data.hits || [];
  // Local pagination: slice the returned hits to the UI per-page size.
  const startIdx = (pageToFetch - 1) * perPage;
  const pageHits = allHits.slice(startIdx, startIdx + perPage);
  setImages(pageHits);
  // Keep totalHits from backend so navigation respects server total.
      const t = Number(data.totalHits || data.total || (data.hits && data.hits.length) || 0);
      setTotalHits(isNaN(t) ? null : t);
      setPage(pageToFetch);
      // scroll to top of results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error details:', error);
      setError(error.message);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  

  const handleLogout = () => {
    setAuth({ token: null, username: null });
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    try { delete axios.defaults.headers.common['Authorization']; } catch (e) {}
  };

  const openDashboard = () => setShowDashboard(true);

  const fetchDashboard = async () => {
    try {
      const token = auth.token || localStorage.getItem('token');
      const resp = await axios.get(`${apiBase}/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      setDashboardData(resp.data || null);
    } catch (err) {
      alert((err.response && err.response.data && err.response.data.error) || err.message);
    }
  };

  

  // Lightbox helpers
  const getLargeImageUrl = (image) => {
    if (!image) return '';
    // common normalized fields used by providers
    return (
      image.largeImageURL ||
      (image.urls && (image.urls.full || image.urls.regular || image.urls.raw)) ||
      image.full ||
      image.regular ||
      image.webformatURL ||
      ''
    );
  };

  const openLightbox = (image) => {
    setLightboxImage(image);
    setShowLightbox(true);
  };

  const closeLightbox = () => {
    setShowLightbox(false);
    setLightboxImage(null);
  };

  // close lightbox on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
    };
    if (showLightbox) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLightbox]);

  // Function to handle the search when the button is clicked
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
  // use unified fetchResults which handles pagination and UI state
  fetchResults(1);
  };

  // small helper to decide owner access


  return (
    <div className="app-container">
      {/* ...existing content... */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-container">
            <div
              className="title-card"
              role="button"
              tabIndex={0}
              onClick={handleTitleClick}
              onKeyDown={handleTitleKeyDown}
              aria-label="Home - clear search and focus input (Ctrl/Cmd + click to reload)"
            >
              <div className="title-row">
                <h1 className="app-title">Photu Search</h1>
                <Logo className="app-logo app-logo-inline" aria-hidden="true" />
              </div>
              
            </div>
          </div>
            <form onSubmit={handleSearch} className="search-form">
            <div className="search-container">
              <div className="search-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search for images..."
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                className="search-input"
              />
            
              {query && (
                <button 
                  type="button" 
                  className="clear-button"
                  onClick={() => setQuery('')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
              <button 
                type="submit" 
                className="search-button"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                )}
              </button>
            </div>
            
          </form>
          

          <div className="auth-controls">
            {auth.token ? (
              <div className="auth-logged">
                {auth.username && !String(auth.username).includes('@') ? (
                  <span className="auth-user">{auth.username}</span>
                ) : null}
                <button className="auth-logout" onClick={handleLogout}>Logout</button>
              </div>
            ) : (
              <div className="auth-header-buttons">
                <button className="auth-open" onClick={() => { localStorage.setItem('preferredAuthMode','login'); setShowAuth(true); setAuthMode('login'); }}>Login</button>
                <button className="auth-open" onClick={() => { localStorage.setItem('preferredAuthMode','signup'); setShowAuth(true); setAuthMode('signup'); }}>Sign up</button>
              </div>
            )}
            <div style={{ marginLeft: '8px' }}>
              {/* Show Dashboard button only to owner (set via REACT_APP_OWNER_EMAIL) */}
              {auth.username && (auth.username === (process.env.REACT_APP_OWNER_EMAIL || '') ) && (
                <button className="auth-open" onClick={openDashboard}>Dashboard</button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        {showBackendHint && (
          <div style={{ background: '#fff5f5', border: '1px solid #ffd6d6', color: '#b91c1c', padding: 12, borderRadius: 6, margin: '12px 20px' }}>
            <strong>Backend not configured:</strong> No `REACT_APP_BACKEND_URL` detected and not running on localhost. Set `REACT_APP_BACKEND_URL` to your API host or run the backend locally to enable searches.
          </div>
        )}
        {error && (
          <div className="error-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Searching for images...</p>
          </div>
        ) : images.length > 0 ? (
          <>
          <div className="image-grid">
            {images.map((image, index) => (
              <div
                key={index}
                className={`image-card ${loadedImages.has(index) ? 'loaded' : ''}`}
                style={{ "--delay": `${(index % 12) * 60}ms` }}
              >
                <div className="image-container">
                  <img
                    src={(image.urls && (image.urls.regular || image.urls.small)) || image.webformatURL}
                    alt={image.tags}
                    loading="lazy"
                    onLoad={() => handleImageLoad(index)}
                    onClick={() => openLightbox(image)}
                  />

                  {/* Floating provider badge on image */}
                  {image.provider && (
                    <div className="provider-badge overlay-badge">{image.provider}</div>
                  )}

                  {/* Overlay actions (appear on hover) */}
                  <div className="image-overlay">
                    <div className="overlay-actions">
                      <button
                        className={`save-button ${savingIds.has(image.webformatURL || image.id) ? 'saving' : ''} ${savedIds.has(image.webformatURL || image.id) ? 'saved' : ''}`}
                        onClick={(e) => handleSave(image, e)}
                      >
                        {savingIds.has(image.webformatURL || image.id) ? 'Saving...' : savedIds.has(image.webformatURL || image.id) ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="image-info">
                  {image.provider !== 'unsplash' && image.provider !== 'pixabay' && image.provider !== 'pexels' ? (
                    <>
                      <p className="image-tags">{image.tags}</p>
                      <p className="image-user">by {image.user}</p>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {/* Pagination controls */}
          <div className="pagination" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <div style={{ color: '#666' }}>
              {totalHits != null ? (
                <span>Showing {((page - 1) * perPage) + 1} - {((page - 1) * perPage) + images.length} of {totalHits}</span>
              ) : (
                <span>Showing {images.length} results</span>
              )}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => fetchResults(Math.max(1, page - 1))} disabled={page <= 1} className="pagination-button">Prev</button>
              <button onClick={() => fetchResults(page + 1)} disabled={images.length < perPage || (totalHits != null && page * perPage >= totalHits)} className="pagination-button">Next</button>
            </div>
          </div>
          </>
        ) : !loading && (
          <div className="no-results">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>Browse our popular categories below</p>
          </div>
        )}
      </main>

      {showAuth && (
        <div className="auth-modal" role="dialog" aria-modal="true">
          <div className="auth-box">
            <div className="auth-tabs">
              <button className={authMode === 'login' ? 'active' : ''} onClick={() => { localStorage.setItem('preferredAuthMode','login'); setAuthMode('login'); }}>Login</button>
              <button className={authMode === 'signup' ? 'active' : ''} onClick={() => { localStorage.setItem('preferredAuthMode','signup'); setAuthMode('signup'); }}>Sign up</button>
            </div>
            <form onSubmit={handleAuthSubmit} className="auth-form">
              <input placeholder="Username" value={authForm.username} onChange={(e) => setAuthForm({...authForm, username: e.target.value})} required />
              <input placeholder="Password" type="password" value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} required />
              <div className="auth-actions">
                <button type="submit" disabled={authLoading}>{authMode === 'login' ? (authLoading ? 'Logging...' : 'Login') : (authLoading ? 'Creating...' : 'Create account')}</button>
                <button type="button" onClick={() => setShowAuth(false)}>Cancel</button>
              </div>
            </form>
            {/* Google sign-in removed */}
          </div>
        </div>
      )}

      {showDashboard && (
        <div className="auth-modal" role="dialog" aria-modal="true">
          <div className="auth-box" style={{ maxWidth: 900 }}>
            <h3>Owner Dashboard</h3>
            <p>Site statistics & user list</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={fetchDashboard}>Refresh</button>
              <button onClick={() => setShowDashboard(false)}>Close</button>
            </div>

            <div style={{ marginTop: 12 }}>
              {dashboardData ? (
                <div>
                  <p style={{ marginBottom: 8 }}>Users: {dashboardData.usersCount}</p>

                  {Array.isArray(dashboardData.users) && dashboardData.users.length > 0 ? (
                    <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>#</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Avatar</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Username</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Email</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Provider</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Created At</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Token</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.users.map((u, idx) => (
                            <tr key={u.username || u.email || idx} style={{ borderBottom: '1px solid #f1f1f1' }}>
                              <td style={{ padding: '8px' }}>{idx + 1}</td>
                              <td style={{ padding: '8px' }}>
                                {u.picture ? (
                                  <img src={u.picture} alt="avatar" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: 40, height: 40, background: '#eee', display: 'inline-block', borderRadius: 4 }} />
                                )}
                              </td>
                              <td style={{ padding: '8px' }}>{u.username || ''}</td>
                              <td style={{ padding: '8px' }}>{u.email || ''}</td>
                              <td style={{ padding: '8px' }}>{u.provider || ''}</td>
                              <td style={{ padding: '8px' }}>{u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</td>
                              <td style={{ padding: '8px' }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <code style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220, display: 'inline-block' }}>{u.token || ''}</code>
                                  {u.token && (
                                    <button
                                      onClick={(e) => {
                                        try {
                                          navigator.clipboard.writeText(u.token);
                                          // small feedback: replace temporarily
                                          const btn = e.currentTarget;
                                          const prev = btn.innerText;
                                          btn.innerText = 'Copied';
                                          setTimeout(() => { if (btn) btn.innerText = prev; }, 1200);
                                        } catch (err) {
                                          // fallback: prompt
                                          window.prompt('Token (copy):', u.token);
                                        }
                                      }}
                                    >Copy</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No users available.</p>
                  )}
                </div>
              ) : (
                <p>No data loaded.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox modal for expanded image view */}
      {showLightbox && lightboxImage && (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
        >
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '92%', maxHeight: '92%', background: '#000', padding: 12, borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}
          >
            <button
              onClick={closeLightbox}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, position: 'absolute', right: 18, top: 12, cursor: 'pointer' }}
            >
              ×
            </button>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', color: '#fff' }}>
              <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                  src={(lightboxImage.largeImageURL || getLargeImageUrl(lightboxImage))}
                  alt={lightboxImage.tags}
                  style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 6, objectFit: 'contain' }}
                />
              </div>
              <div style={{ width: 280, maxHeight: '80vh', overflow: 'auto' }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 16 }}>{lightboxImage.user || lightboxImage.username || ''}</strong>
                </div>
                {lightboxImage.tags && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ color: '#ddd', fontSize: 13 }}>Tags</div>
                    <div style={{ marginTop: 4 }}>{lightboxImage.tags}</div>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button onClick={(e) => { e.stopPropagation(); handleSave(lightboxImage, e); }} style={{ padding: '8px 12px' }}>Save / Download</button>
                </div>
                <div style={{ marginTop: 12, color: '#aaa', fontSize: 12 }}>
                  <div>Provider: {lightboxImage.provider}</div>
                  {lightboxImage.likes != null && <div>Likes: {lightboxImage.likes}</div>}
                  {lightboxImage.views != null && <div>Views: {lightboxImage.views}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p>
          Made with ❤️ by {' '}
          <a href="https://github.com/Surya-1301" target="_blank" rel="noreferrer"> R3TiR3D</a>
          {' '}— © {new Date().getFullYear()}
        </p>
      </footer>
      {/* toast */}
      {toast && (
        <div className="app-toast">{toast}</div>
      )}
    </div>
  );
}

export default App;
