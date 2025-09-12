Environment files for the backend

Purpose
- Store example and local environment variables used by `backend/server.js`.

Files
- `.env.example` - copy to `.env` or use to populate your deployment environment variables.
- `.env.local` - optional local template (do not commit secrets).

How to use locally
1. From `backend/` copy the example to an actual `.env` file:

   cp env/.env.example .env

2. Edit `.env` and fill in your real keys (PEXELS_API_KEY, etc).
3. Start the server (from `backend/`):

   npm install
   node server.js

Security
- Never commit your real `.env` with secrets to version control.
- Use your platform's secret management for production (Netlify/Vercel/Render environment variables).

Notes
- Use the provided `.env.example` to populate your backend environment variables. Remove or adjust any provider entries you don't use.
