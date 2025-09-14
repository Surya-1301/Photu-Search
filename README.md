# Photu Search

Photu Search is a small image search web app that aggregates results from multiple providers (Unsplash, Pixabay, Pexels) and offers a simple React frontend with a lightweight Node backend for provider proxying and authentication.

This README explains how to run the project locally, configure provider API keys, and the main developer points for customization.

<p align="center">
  <a href="https://photu-search.netlify.app/">
    <img src="https://img.shields.io/badge/View Demo-0077B5?style=for-the-badge&logo=linkedin&logoColor=white"/>
  </a>
</p>

## Features
- Search images across multiple providers (Unsplash, Pixabay, Pexels)
- JWT-based signup/login (local users stored in `backend/users.json` for demo)
- Simple metric-free download/save of images
- Pagination with user-selectable page size
- Backend merges & deduplicates provider responses

## Repo structure

Top-level layout:

```
.
├── backend/                # Node backend: API, auth, provider proxy
│   ├── server.js
│   ├── users.json
│   ├── .env.example
│   └── ...
├── public/                 # Static assets served in dev/production
├── src/                    # React app (Create React App)
├── package.json
└── README.md
```

## Requirements
- Node.js 16+ (or latest LTS)
- npm

## Quick start (development)

1. Install dependencies (project root):

```bash
npm install
```

2. Backend env: create a local `.env` (do NOT commit secrets)

```bash
# Create a local backend env from the example and fill values.
cp backend/env/.env.example backend/.env
# IMPORTANT: never commit `backend/.env`. Add `backend/.env` to .gitignore
# For production (Netlify) set `PEXELS_API_KEY`, `PIXABAY_API_KEY`, and
# `UNSPLASH_ACCESS_KEY` in the site UI or CI environment instead of committing.
```

3. Start backend (port 10000 by default)

```bash
cd backend
node server.js
```

4. Start frontend (project root)

```bash
npm start
```

5. Open the app in your browser: `http://localhost:3000`

If you prefer serving frontend and backend together, build the frontend (`npm run build`) and copy `build/` into the appropriate server static folder.

## Environment variables

Backend (`backend/.env`): recommended keys

- `PORT` - (optional) port for backend (default `10000`)
- `JWT_SECRET` - secret used to sign JWTs (required for production)
- `UNSPLASH_ACCESS_KEY` - Unsplash API key
- `PIXABAY_API_KEY` - Pixabay API key
- `PEXELS_API_KEY` - Pexels API key
- `OWNER_EMAIL` - owner username/email (used to enable dashboard)
- `ADMIN_TOKEN` - optional admin token to access dashboard
- `MAX_PER_PAGE` - backend cap for items per request (default `500`)

Frontend (project root `.env`):

- `REACT_APP_BACKEND_URL` - explicit backend URL (e.g. `http://localhost:10000`)
- `REACT_APP_FETCH_SIZE` - how many items frontend requests from backend per page (default `200`)

Notes:
- Freepik integration was removed from the project. Only Unsplash, Pixabay and Pexels are supported out-of-the-box.

## Authentication

- Signup and login use a simple file-backed store in `backend/users.json` and issue JWTs valid for 7 days.
- After login the frontend stores `token` and `username` in `localStorage` and sets the `Authorization: Bearer` header for authenticated requests.

Endpoints:
- `POST /auth/signup` - body: `{ username, password }` → returns `{ username, token }`
- `POST /auth/login` - body: `{ username, password }` → returns `{ username, token }`
- `GET /me` - protected: returns `{ user }` (validates the token)
- `GET /dashboard` - owner/admin only (requires `ADMIN_TOKEN` or owner identity)

## Image API

- `GET /api/providers` — returns which providers are configured.
- `GET /api/images?query=...&provider=both|pixabay|unsplash|pexels&per_page=...&page=...` — search images.

Behavior:
- `provider=both` will query all configured providers in parallel, interleave and dedupe results, and return up to `per_page` hits.
- Backend caps `per_page` at `MAX_PER_PAGE` (defaults to 500).

Example:

```
GET /api/images?query=mountain&provider=both&per_page=50&page=1
```

Response shape:

- `{ totalHits, hits: [ { webformatURL, largeImageURL, tags, likes, views, user, provider, url } ] }`

## Troubleshooting

- If you see `Request failed: network` from the frontend, confirm the backend is running and `REACT_APP_BACKEND_URL` is set if needed.
- If an upstream provider returns 4xx/5xx, the backend will forward the upstream error body and status to help debugging.

## Development notes

- The app was built to be simple and easy to extend. Normalizing provider response shapes is done in the backend so the frontend rendering code is straightforward.
- Static files are served from `public/` during development; when deploying make sure to build the React app and serve `build/`.

## Contributing

1. Fork the repo and create a feature branch.
2. Make changes and add tests where appropriate.
3. Open a PR with a clear description of your changes.

## License

This project template is provided as-is. Add a license file if you intend to publish.
# Image Search App

A web application that allows users to search for images using the Pixabay API. Built with HTML, CSS, JavaScript, and Node.js.

## Features

- Search for images using keywords
- Responsive design
- Infinite scroll pagination
- Image statistics (likes and views)
- Lazy loading for better performance

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/image-search-app.git
cd image-search-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node server.js
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Project Structure
image-search-app/
├── server.js          # Express server and API endpoints
├── index.html         # Main HTML file
├── style.css          # Styles
├── script.js          # Frontend JavaScript
├── package.json       # Project dependencies
└── README.md          # Project documentation
```

## API Endpoints

## Prerequisites
Node.js (v16+ recommended)
npm (Node Package Manager)
  - HTML5
## Local development
1. Clone the repository:
```bash
git clone https://github.com/yourusername/image-search-app.git
cd image-search-app
```
2. Install dependencies and run Netlify Dev (serves the frontend and Netlify Functions locally):
```bash
npm install
npm run netlify:dev
```
The app will be available at http://localhost:8888 when using Netlify Dev.
  - CSS3
  - JavaScript (ES6+)
## Project Structure
This project is a React app (Create React App) with Netlify Functions providing the backend API.
```
image-search-app/
├── netlify/functions/  # Serverless API endpoints (auth, images, dashboard)
├── src/                # React source
├── public/             # Static public assets
├── build/              # Production build output (generated)
├── package.json        # Project dependencies and scripts
└── README.md           # Project documentation
```
Backend is implemented as Netlify Functions (serverless). For production you'll want a persistent datastore (Supabase, S3, FaunaDB, etc.) because Netlify Function filesystem is ephemeral.

Google Images (Programmable Search) support
- To enable Google Images provider set the following environment variables on Netlify (or in your local `.env` for dev):
  - `GOOGLE_API_KEY` - API key for Google Custom Search JSON API
  - `GOOGLE_CSE_ID` - Custom Search Engine ID (cx) configured for Image search

Use provider `google` or `googleimages` when calling `/api/images`.
 
Unsplash provider enhancements
- The Unsplash provider now accepts extra query params passed to `/api/images`:
  - `per_page` (number) — results per page (1..30, defaults to 10)
  - `orientation` (string) — one of `landscape`, `portrait`, `squarish`
  - `color` (string) — color filter supported by Unsplash (e.g., `black_and_white`, `black`, `white`, `yellow`, `orange`, `red`, `purple`, `magenta`, `green`, `teal`, `blue`)

Example request:

```
/api/images?provider=unsplash&query=mountains&per_page=15&orientation=landscape&color=blue
```

Enhanced Unsplash response shape (each hit contains):
- `id` — Unsplash image ID
- `webformatURL`, `smallURL`, `fullURL`, `rawURL` — various image sizes/URLs
- `tags` — alt text or description
- `likes`, `views` — numeric stats (when available)
- `user` — photographer username or name
- `userProfile` — photographer profile URL (for attribution)
- `provider` — `unsplash`

Pixabay provider enhancements
- The Pixabay provider now accepts additional query params:
  - `per_page` (number) — results per page (1..200, defaults to 20)
  - `image_type` (string) — e.g., `photo`, `illustration`, `vector`
  - `safesearch` (true|false) — filter explicit content (defaults to `true`)
  - `order` (string) — `popular` or `latest` (defaults to `popular`)
  - `category` (string) — Pixabay category slug (e.g., `nature`, `fashion`)

Example request:

```
/api/images?provider=pixabay&query=mountains&per_page=24&image_type=photo&order=latest
```

Enhanced Pixabay response shape (each hit contains):
- `id` — Pixabay image id
- `webformatURL`, `largeImageURL`, `pageURL` — image links
- `tags` (string) and `tagsArray` (array)
- `likes`, `views` — numeric stats
- `user`, `userImageURL` — photographer/creator info
- `provider` — `pixabay`
5. Open a Pull Request
