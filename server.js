const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();

// Enable CORS for all origins
app.use(cors());

// Basic middleware for logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Pixabay API configuration
const PIXABAY_API_KEY = '29904377-5d788804b733434f876aed7ea';
const PIXABAY_API_URL = 'https://pixabay.com/api/';

// Route to handle image search
app.get('/api/images', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const per = Number(req.query.per_page) || 30;
    const response = await axios.get(PIXABAY_API_URL, {
      params: {
        key: PIXABAY_API_KEY,
        q: query,
        image_type: 'photo',
        per_page: per
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ 
      error: 'Failed to fetch images',
      details: error.message 
    });
  }
});

// Basic route for testing
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Use port 3000 instead of 5000
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on https://voluble-melomakarona-866e9c.netlify.app`);
  console.log('Current directory:', __dirname);
  console.log('Static files being served from:', path.join(__dirname));
}); 