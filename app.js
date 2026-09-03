const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const suggestionsList = document.getElementById('suggestions');
const geoBtn = document.getElementById('geoBtn');
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

// Geolocation Handler
geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  geoBtn.textContent = '⌛';
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        loadWeatherData(latitude, longitude, "Your Location");
      } catch (err) {
        console.error("GPS Reverse Geocode Error:", err);
      } finally {
        geoBtn.textContent = '🎯';
      }
    },
    () => {
      alert('Unable to retrieve location. Please check browser permissions.');
      geoBtn.textContent = '🎯';
    }
  );
});

// Interactive Map Toggle
mapPlaceholder.addEventListener('click', () => {
  if (currentCoords.lat && currentCoords.lon) {
    mapIframe.src = `https://maps.google.com/maps?q=${currentCoords.lat},${currentCoords.lon}&z=11&output=embed`;
    mapWrapper.classList.add('active');
  }
});

// Auto-suggest Navigation
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

async function fetchDashboardData(city) {
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      alert("City not found!");
      return;
    }

    const { latitude, longitude, name, admin1, country } = geoData.results[0];
    const locationName = `${name}${admin1 ? ', ' + admin1 : ''}, ${country || ''}`;
    
    loadWeatherData(latitude, longitude, locationName);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

async function loadWeatherData(lat, lon, locationName) {
  document.getElementById('cityName').textContent = locationName;
  currentCoords = { lat, lon };

  if (mapWrapper.classList.contains('active')) {
    mapIframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=11&output=embed`;
  }

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max&timezone=auto`
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

  renderHourly(weatherData.hourly);
  renderForecast(weatherData.daily);
  fetchAirQuality(lat, lon);
  fetchNewsFast(locationName);
}

async function fetchAirQuality(lat, lon) {
  const aqiBadge = document.getElementById('aqiBadge');
  try {
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`);
    const data = await res.json();
    const aqi = data.current ? data.current.european_aqi : null;

    if (aqi !== null) {
      aqiBadge.className = 'aqi-badge';
      if (aqi <= 20) {
        aqiBadge.textContent = `AQI ${aqi} (Good)`;
        aqiBadge.classList.add('aqi-good');
      } else if (aqi <= 50) {
        aqiBadge.textContent = `AQI ${aqi} (Moderate)`;
        aqiBadge.classList.add('aqi-moderate');
      } else {
        aqiBadge.textContent = `AQI ${aqi} (Poor)`;
        aqiBadge.classList.add('aqi-poor');
      }
    } else {
      aqiBadge.textContent = 'AQI N/A';
    }
  } catch (err) {
    aqiBadge.textContent = 'AQI --';
  }
}

function renderHourly(hourly) {
  const hourlySlider = document.getElementById('hourlySlider');
  const nowHour = new Date().getHours();
  
  let html = '';
  for (let i = nowHour; i < nowHour + 24; i++) {
    if (!hourly.time[i]) break;
    const timeStr = new Date(hourly.time[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const code = hourly.weather_code[i];
    const temp = Math.round(hourly.temperature_2m[i]);
    const icon = (weatherMap[code] || { icon: "☀️" }).icon;

    html += `
      <div class="hourly-item">
        <span class="hourly-time">${timeStr}</span>
        <span class="hourly-icon">${icon}</span>
        <span class="hourly-temp">${temp}°C</span>
      </div>
    `;
  }
  hourlySlider.innerHTML = html;
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

// Relative time calculator
function getRelativeTime(dateString) {
  if (!dateString) return 'Recent';
  const pubDate = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now - pubDate) / (1000 * 60));

  if (diffInMinutes < 60) return `${Math.max(1, diffInMinutes)}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

async function fetchNewsFast(fullLocationString) {
  const newsFeed = document.getElementById('newsFeed');
  newsFeed.innerHTML = `
    <div class="news-card-skeleton"></div>
    <div class="news-card-skeleton"></div>
    <div class="news-card-skeleton"></div>
    <div class="news-card-skeleton"></div>
  `;

  const city = fullLocationString.split(',')[0].trim();
  
  // Clean search query without hardcoding regional gl/ceid parameters
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(city)}&hl=en-US&gl=US&ceid=US:en`;
  const fallbackUrl = `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en`;

  const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`, { signal: controller.signal });
      clearTimeout(timer);
      const data = await res.json();
      return (data.status === 'ok' && data.items && data.items.length > 0) ? data.items : null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  let items = await fetchWithTimeout(rssUrl);
  
  // If city search fails, search for broader query or general global news
  if (!items) {
    items = await fetchWithTimeout(fallbackUrl);
  }

  if (!items) {
    newsFeed.innerHTML = "<p class='loading-state'>No live news available right now.</p>";
    return;
  }

  newsFeed.innerHTML = items.slice(0, 8).map(article => {
    const timeAgo = getRelativeTime(article.pubDate);
    const source = article.author || 'Google News';

    return `
      <a class="news-article-card" href="${article.link}" target="_blank" rel="noopener noreferrer">
        <div class="article-top">
          <div class="article-meta-header">
            <span class="source-chip" title="${source}">${source}</span>
            <span class="time-stamp">${timeAgo}</span>
          </div>
          <h3 class="article-title">${article.title}</h3>
        </div>
        <div class="article-footer">
          <span class="read-more-link">Read article ↗</span>
        </div>
      </a>
    `;
  }).join('');
}
fetchDashboardData('Prayagraj');
