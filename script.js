const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const imagesGrid = document.getElementById('images-grid');
const loading = document.getElementById('loading');
const loadMoreBtn = document.getElementById('load-more');

let currentPage = 1;
let currentQuery = '';
let totalHits = 0;

// Function to create image card
function createImageCard(hit) {
  const card = document.createElement('div');
  card.className = 'image-card';

  const img = document.createElement('img');
  img.src = hit.webformatURL;
  img.alt = hit.tags;
  img.loading = 'lazy'; // Enable lazy loading

  const title = document.createElement('p');
  title.textContent = hit.tags;

  const likes = document.createElement('div');
  likes.className = 'image-stats';
  likes.innerHTML = `❤️ ${hit.likes} | 👁️ ${hit.views}`;

  card.appendChild(img);
  card.appendChild(title);
  card.appendChild(likes);
  return card;
}

// Function to fetch images
async function fetchImages(query, page = 1) {
  try {
  const backendUrl = (window && window.__BACKEND_URL__) || '/';
  const url = `${backendUrl}api/images?query=${encodeURIComponent(query)}&page=${page}`;
    console.log('Fetching from URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Received data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching images:', error);
    throw error;
  }
}

// Function to display images
function displayImages(hits) {
  hits.forEach(hit => {
    const card = createImageCard(hit);
    imagesGrid.appendChild(card);
  });
}

// Function to handle search
async function handleSearch(e) {
  e.preventDefault();
  
  const query = input.value.trim();
  if (!query) return;

  currentQuery = query;
  currentPage = 1;
  imagesGrid.innerHTML = '';
  loading.style.display = 'block';
  loadMoreBtn.style.display = 'none';

  try {
    console.log('Starting search for query:', query);
    const data = await fetchImages(query);
    console.log('Search completed, received data:', data);
    
    totalHits = data.totalHits;
    
    if (!data.hits || data.hits.length === 0) {
      imagesGrid.innerHTML = "<p>No images found. Try another search.</p>";
      return;
    }

    displayImages(data.hits);
    
    // Show load more button if there are more results
    if (currentPage * 20 < totalHits) {
      loadMoreBtn.style.display = 'block';
    }
  } catch (error) {
    console.error('Search error:', error);
    imagesGrid.innerHTML = `<p>Error: ${error.message}. Please try again.</p>`;
  } finally {
    loading.style.display = 'none';
  }
}

// Function to load more images
async function loadMore() {
  currentPage++;
  loading.style.display = 'block';
  loadMoreBtn.style.display = 'none';

  try {
    const data = await fetchImages(currentQuery, currentPage);
    displayImages(data.hits);
    
    // Show/hide load more button based on remaining results
    if (currentPage * 20 < totalHits) {
      loadMoreBtn.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading more images:', error);
  } finally {
    loading.style.display = 'none';
  }
}

// Event listeners
form.addEventListener('submit', handleSearch);
loadMoreBtn.addEventListener('click', loadMore);
