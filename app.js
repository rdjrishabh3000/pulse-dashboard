const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const suggestionsList = document.getElementById('suggestions');
const mapWrapper = document.querySelector('.map-wrapper');
const mapPlaceholder = document.getElementById('mapPlaceholder');
const mapIframe = document.getElementById('mapIframe');

let debounceTimer;
let selectedIndex = -1;
let currentCoords = { lat: null, lon: null };

const weatherMap = {
  0: { text: "Clear sky", icon: "☀️" },
  1: { text: "Mainly clear", icon: "🌤️" },
  2: { text: "Partly cloudy", icon: "⛅" },
  3: { text: "Overcast", icon: "☁️" },
  45: { text: "Foggy", icon: "🌫️" },
  48: { text: "Depositing rime fog", icon: "🌫️" },
  51: { text: "Light drizzle", icon: "🌧️" },
  61: { text: "Slight rain", icon: "🌧️" },
  63: { text: "Moderate rain", icon: "🌧️" },
  65: { text: "Heavy rain", icon: "🌧️" },
  80: { text: "Rain showers", icon: "🌦️" },
  95: { text: "Thunderstorm", icon: "⛈️" }
};

// Optimized Low-res Fallback Image
const FALLBACK_NEWS_IMG = "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=100&auto=format&fit=crop&q=60";

// Lazy Map Loading on User Click
mapPlaceholder.addEventListener('click', () => {
  if (currentCoords.lat && currentCoords.lon) {
    mapIframe.src = `https://maps.google.com/maps?q=${currentCoords.lat},${currentCoords.lon}&z=11&output=embed`;
    mapWrapper.classList.add('active');
  }
});

// Keyboard Navigation
cityInput.addEventListener('keydown', (e) => {
  const items = suggestionsList.querySelectorAll('li');
  if (!suggestionsList.classList.contains('active') || items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = (selectedIndex + 1) % items.length;
    updateHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    updateHighlight(items);
  } else if (e.key === 'Enter') {
    if (selectedIndex > -1 && items[selectedIndex]) {
      e.preventDefault();
      selectItem(items[selectedIndex]);
    }
  }
});

function updateHighlight(items) {
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// Search Submissions
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (selectedIndex === -1) {
    const query = cityInput.value.trim();
    if (query) {
      suggestionsList.classList.remove('active');
      fetchDashboardData(query);
    }
  }
});

// Auto-suggest
cityInput.addEventListener('input', () => {
  const query = cityInput.value.trim();
  clearTimeout(debounceTimer);
  selectedIndex = -1;

  if (query.length < 2) {
    suggestionsList.classList.remove('active');
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`);
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        renderSuggestions(data.results);
      } else {
        suggestionsList.classList.remove('active');
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  }, 300);
});

function renderSuggestions(locations) {
  suggestionsList.innerHTML = locations.map(loc => {
    const label = `${loc.name}${loc.admin1 ? ', ' + loc.admin1 : ''}, ${loc.country || ''}`;
    return `<li data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${label}">${label}</li>`;
  }).join('');

  selectedIndex = -1;
  suggestionsList.classList.add('active');
}

function selectItem(liElement) {
  const lat = liElement.getAttribute('data-lat');
  const lon = liElement.getAttribute('data-lon');
  const name = liElement.getAttribute('data-name');

  cityInput.value = name;
  suggestionsList.classList.remove('active');
  selectedIndex = -1;

  loadWeatherData(lat, lon, name);
}

suggestionsList.addEventListener('click', (e) => {
  if (e.target.tagName === 'LI') {
    selectItem(e.target);
  }
});

document.addEventListener('click', (e) => {
  if (!searchForm.contains(e.target)) {
    suggestionsList.classList.remove('active');
    selectedIndex = -1;
  }
});

// Data Handlers
async function fetchDashboardData(city) {
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      alert("City not found!");
      return;
    }

    const { latitude, longitude, name, country } = geoData.results[0];
    const locationName = `${name}, ${country || ''}`;
    
    loadWeatherData(latitude, longitude, locationName);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

async function loadWeatherData(lat, lon, locationName) {
  document.getElementById('cityName').textContent = locationName;
  currentCoords = { lat, lon };

  // Reset map view state on location change
  if (mapWrapper.classList.contains('active')) {
    mapIframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=11&output=embed`;
  }

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max&timezone=auto`
  );
  const weatherData = await weatherRes.json();

  const current = weatherData.current;
  const info = weatherMap[current.weather_code] || { text: "Clear", icon: "🌤️" };

  document.getElementById('temperature').textContent = Math.round(current.temperature_2m);
  document.getElementById('weatherIcon').textContent = info.icon;
  document.getElementById('weatherDesc').textContent = info.text;

  document.getElementById('feelsLike').textContent = `${Math.round(current.apparent_temperature)}°C`;
  document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
  document.getElementById('windSpeed').textContent = `${current.wind_speed_10m} km/h`;
  document.getElementById('pressure').textContent = `${Math.round(current.surface_pressure)} hPa`;

  renderForecast(weatherData.daily);
  fetchNews(locationName.split(',')[0]);
}

function renderForecast(daily) {
  const forecastGrid = document.getElementById('forecastGrid');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  let html = '';
  for (let i = 1; i <= 3; i++) {
    const date = new Date(daily.time[i]);
    const dayName = days[date.getDay()];
    const code = daily.weather_code[i];
    const temp = Math.round(daily.temperature_2m_max[i]);
    const icon = (weatherMap[code] || { icon: "☀️" }).icon;

    html += `
      <div class="forecast-day">
        <span class="day-name">${dayName}</span>
        <span class="day-icon">${icon}</span>
        <span class="day-temp">${temp}°C</span>
      </div>
    `;
  }
  forecastGrid.innerHTML = html;
}

function extractArticleImage(item) {
  if (item.thumbnail && item.thumbnail.length > 0) return item.thumbnail;
  if (item.enclosure && item.enclosure.link) return item.enclosure.link;

  if (item.description) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(item.description, 'text/html');
    const img = doc.querySelector('img');
    if (img && img.src) return img.src;
  }

  return FALLBACK_NEWS_IMG;
}

async function fetchNews(city) {
  const newsFeed = document.getElementById('newsFeed');
  newsFeed.innerHTML = `
    <div class="news-item-skeleton"></div>
    <div class="news-item-skeleton"></div>
    <div class="news-item-skeleton"></div>
  `;

  try {
    const query = encodeURIComponent(city);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
    const data = await res.json();

    let articles = data.items || [];
    
    if (articles.length === 0) {
      const fallbackRss = `https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en`;
      const fallbackRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(fallbackRss)}`);
      const fallbackData = await fallbackRes.json();
      articles = fallbackData.items || [];
    }

    if (articles.length === 0) {
      newsFeed.innerHTML = "<p class='loading-state'>No live news found for this area.</p>";
      return;
    }

    // Lazy load images asynchronously with fallbacks
    newsFeed.innerHTML = articles.slice(0, 10).map(article => {
      const pubDate = new Date(article.pubDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
      const imgSrc = extractArticleImage(article);

      return `
        <div class="news-item">
          <img 
            class="news-thumb" 
            src="${imgSrc}" 
            alt="News thumbnail" 
            loading="lazy" 
            decoding="async"
            onerror="this.src='${FALLBACK_NEWS_IMG}'" 
          />
          <div class="news-content">
            <a href="${article.link}" target="_blank" rel="noopener noreferrer">${article.title}</a>
            <p>${pubDate} • ${article.author || 'Live Feed'}</p>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error("Error fetching news:", error);
    newsFeed.innerHTML = "<p class='loading-state'>Unable to load news feed right now.</p>";
  }
}

// Initial load
fetchDashboardData('Prayagraj');