const axios = require('axios');

exports.handler = async function(event) {
  try {
    const q = (event.queryStringParameters && event.queryStringParameters.query) || '';
    const providerParam = (event.queryStringParameters && event.queryStringParameters.provider) || '';
    const page = (event.queryStringParameters && event.queryStringParameters.page) || 1;
    const providerLower = (providerParam || '').toLowerCase();

    let provider = 'unsplash';
    if (providerLower) provider = providerLower;
    else if (process.env.USE_PIXABAY === 'true') provider = 'pixabay';

    // parse per_page, default to 30
    const reqPerPage = Number((event.queryStringParameters && event.queryStringParameters.per_page) || 30) || 30;

    if ((provider === 'both' || provider === 'pixabay+unsplash' || provider === 'unsplash+pixabay')) {
      if (!process.env.UNSPLASH_ACCESS_KEY) return { statusCode: 400, body: JSON.stringify({ error: 'UNSPLASH_ACCESS_KEY is required when provider=both' }) };
      if (!process.env.PIXABAY_API_KEY) return { statusCode: 400, body: JSON.stringify({ error: 'PIXABAY_API_KEY is required when provider=both' }) };
      // Aim to return `reqPerPage` combined images using a 50/50 ratio.
      const desired = reqPerPage;
      const ratioUnsplash = 0.5; // 50% Unsplash
      const ratioPixabay = 1 - ratioUnsplash; // 50% Pixabay
      // Unsplash max per_page is 30; ensure we don't exceed provider limits
      const unsplashPer = Math.min(30, Math.ceil(desired * ratioUnsplash));
      const pixabayPer = Math.min(200, Math.ceil(desired * ratioPixabay));

      const pixabayUrl = process.env.PIXABAY_API_URL || 'https://pixabay.com/api/';
      const unsplashPromise = axios.get(`https://api.unsplash.com/search/photos`, {
        headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
        params: { query: q, page, per_page: unsplashPer }
      });
      const pixabayPromise = axios.get(pixabayUrl, { params: { key: process.env.PIXABAY_API_KEY, q, image_type: 'photo', per_page: pixabayPer, page } });

      const [unsplashResp, pixabayResp] = await Promise.all([unsplashPromise, pixabayPromise]);
      const uResults = (unsplashResp.data && unsplashResp.data.results) || [];
      const unsplashHits = uResults.map(r => ({ webformatURL: (r.urls && (r.urls.small || r.urls.regular || r.urls.full)) || '', tags: r.alt_description || r.description || '', likes: r.likes || 0, views: r.views || 0, user: (r.user && (r.user.username || r.user.name)) || '', provider: 'unsplash' }));
      const pResults = (pixabayResp.data && pixabayResp.data.hits) || [];
      const pixabayHits = pResults.map(p => ({ webformatURL: p.webformatURL || p.previewURL || p.largeImageURL || '', tags: p.tags || '', likes: p.likes || 0, views: p.views || 0, user: p.user || '', provider: 'pixabay' }));

      // Interleave to blend providers, then dedupe by URL (or fallback key)
      const maxLen = Math.max(unsplashHits.length, pixabayHits.length);
      const interleaved = [];
      for (let i = 0; i < maxLen; i++) {
        if (unsplashHits[i]) interleaved.push(unsplashHits[i]);
        if (pixabayHits[i]) interleaved.push(pixabayHits[i]);
      }
      const seen = new Set();
      const mergedUnique = [];
      for (const item of interleaved) {
        const key = (item.webformatURL || (item.user + '|' + item.tags)).trim();
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        mergedUnique.push(item);
      }

      // Return up to `desired` items (if available)
      const hits = mergedUnique.slice(0, desired);
      return { statusCode: 200, body: JSON.stringify({ totalHits: mergedUnique.length, hits }) };
    }

    if (provider === 'pixabay') {
      if (!process.env.PIXABAY_API_KEY) return { statusCode: 400, body: JSON.stringify({ error: 'PIXABAY_API_KEY is required when provider=pixabay' }) };
      const pixabayUrl = process.env.PIXABAY_API_URL || 'https://pixabay.com/api/';
      const per = Number((event.queryStringParameters && event.queryStringParameters.per_page) || 30) || 30;
      const pixabayResp = await axios.get(pixabayUrl, { params: { key: process.env.PIXABAY_API_KEY, q, image_type: 'photo', per_page: per, page } });
      return { statusCode: 200, body: JSON.stringify(pixabayResp.data) };
    }

    if (provider === 'pinterest') {
      if (!process.env.PINTEREST_ACCESS_TOKEN) return { statusCode: 400, body: JSON.stringify({ error: 'PINTEREST_ACCESS_TOKEN is required when provider=pinterest' }) };
      const pinterestUrl = process.env.PINTEREST_API_URL || 'https://api.pinterest.com/v5/search/pins';
      const pinterestResp = await axios.get(pinterestUrl, { headers: { 'Authorization': `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`, 'Accept': 'application/json' }, params: { query: q, page: page, page_size: 10 } });
      const items = pinterestResp.data.items || pinterestResp.data.results || pinterestResp.data.data || [];
      const hits = items.map(item => ({ webformatURL: (item.images && (item.images.original && item.images.original.url)) || item.image_url || (item.media && item.media[0] && (item.media[0].url || item.media[0].src)) || '', tags: item.description || item.title || item.alt_text || '', likes: item.reactions_count || item.like_count || 0, views: item.view_count || 0, user: (item.owner && (item.owner.username || item.owner.name)) || (item.creator && (item.creator.username || item.creator.name)) || '' }));
      return { statusCode: 200, body: JSON.stringify({ totalHits: pinterestResp.data.total || (pinterestResp.data.count || items.length), hits }) };
    }

    // Google Images via Programmable Search (Custom Search JSON API)
    if (provider === 'google' || provider === 'googleimages') {
      // Requires two env vars: GOOGLE_API_KEY and GOOGLE_CSE_ID (search engine id)
      if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CSE_ID) {
        return { statusCode: 400, body: JSON.stringify({ error: 'GOOGLE_API_KEY and GOOGLE_CSE_ID are required when provider=google' }) };
      }

      const googleUrl = 'https://www.googleapis.com/customsearch/v1';
      try {
        const resp = await axios.get(googleUrl, {
          params: {
            key: process.env.GOOGLE_API_KEY,
            cx: process.env.GOOGLE_CSE_ID,
            q,
            searchType: 'image',
            num: 10,
            start: Math.max(1, (Number(page) - 1) * 10 + 1)
          }
        });

        const items = resp.data.items || [];
        const hits = items.map(item => ({
          webformatURL: (item.link) || (item.image && item.image.thumbnailLink) || '',
          tags: item.title || item.snippet || '',
          likes: 0,
          views: 0,
          user: item.displayLink || item.title || '',
          provider: 'google'
        }));

        return { statusCode: 200, body: JSON.stringify({ totalHits: resp.data.searchInformation && resp.data.searchInformation.totalResults ? Number(resp.data.searchInformation.totalResults) : hits.length, hits }) };
      } catch (err) {
        console.error('google images err', err && err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Google Images search failed' }) };
      }
    }

    // Default unsplash
    if (!process.env.UNSPLASH_ACCESS_KEY) return { statusCode: 400, body: JSON.stringify({ error: 'UNSPLASH_ACCESS_KEY is required for Unsplash provider' }) };
  const per = Number((event.queryStringParameters && event.queryStringParameters.per_page) || 30) || 30;
  const unsplashResp = await axios.get(`https://api.unsplash.com/search/photos`, { headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }, params: { query: q, page, per_page: per } });
    const results = unsplashResp.data.results || [];
    const unsplashHits = results.map(r => ({ webformatURL: (r.urls && (r.urls.small || r.urls.regular || r.urls.full)) || '', tags: r.alt_description || r.description || '', likes: r.likes || 0, views: r.views || 0, user: (r.user && (r.user.username || r.user.name)) || '', provider: 'unsplash' }));
    return { statusCode: 200, body: JSON.stringify({ totalHits: unsplashResp.data.total || results.length, hits: unsplashHits }) };
  } catch (err) {
    console.error('api-images err', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err && err.message ? err.message : 'unknown' }) };
  }
};
