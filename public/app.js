/**
 * Marrakech Bus Tracking - Frontend Application
 * Real-time bus tracking with Leaflet.js, Socket.io, and custom bus icons
 */

const MARRAKECH_CENTER = [31.6295, -7.9811];
const DEFAULT_ZOOM = 13;

// Define bus icon colors for each line
const busColors = {
  'Ligne 1': '#667eea',
  'Ligne 12': '#764ba2',
  'Ligne 6': '#f44336',
};

// Full official ALSA bus routes with complete waypoints
const fullRouteWaypoints = {
  'Ligne 1': [
    { lat: 31.6258, lng: -7.9891 }, // Arset El Bilk / Jemaa El Fna (START)
    { lat: 31.6342, lng: -7.9995 }, // Bab Doukkala
    { lat: 31.6380, lng: -8.0050 }, // Guéliz / Av. Mohammed V
    { lat: 31.6520, lng: -7.9980 }, // Daoudiate / Rouidate Terminus (END)
    { lat: 31.6258, lng: -7.9891 }, // Return to Arset El Bilk
  ],
  'Ligne 12': [
    { lat: 31.6210, lng: -7.9920 }, // Sidi Mimoun (START)
    { lat: 31.6342, lng: -7.9995 }, // Bab Doukkala
    { lat: 31.6308, lng: -8.0132 }, // Gare de Marrakech
    { lat: 31.6550, lng: -8.0180 }, // Route de Casablanca
    { lat: 31.6710, lng: -8.0150 }, // Marjane Hypermarket Terminus (END)
    { lat: 31.6210, lng: -7.9920 }, // Return to Sidi Mimoun
  ],
  'Ligne 6': [
    { lat: 31.6240, lng: -7.9860 }, // Place Lamssallah / Medina (START)
    { lat: 31.6120, lng: -7.9950 }, // Bab Ahmar / Kasbah
    { lat: 31.6200, lng: -8.0100 }, // Boulevard El Yarmouk
    { lat: 31.6280, lng: -8.0300 }, // Targa / Massira entrance
    { lat: 31.6340, lng: -8.0480 }, // Massira / Inara Terminus (END)
    { lat: 31.6240, lng: -7.9860 }, // Return to Place Lamssallah
  ],
};

// Route metadata
const routeMetadata = {
  'Ligne 1': {
    name: 'Ligne 1: Arset El Bilk - Daoudiate/Rouidate',
    description: 'Jemaa El Fna → Bab Doukkala → Guéliz → Rouidate',
    color: '#667eea',
    speed: 40,
  },
  'Ligne 12': {
    name: 'Ligne 12: Sidi Mimoun - Marjane',
    description: 'Sidi Mimoun → Gare → Marjane',
    color: '#764ba2',
    speed: 50,
  },
  'Ligne 6': {
    name: 'Ligne 6: Place Lamssallah - Massira/Inara',
    description: 'Medina → Kasbah → Massira/Inara',
    color: '#f44336',
    speed: 45,
  },
};

const appState = {
  socket: null,
  map: null,
  busMarkers: new Map(),
  polylines: new Map(),
  userBus: null,
  isShareingLocation: false,
  watchPositionId: null,
  subscribedBuses: new Set(),
  lastUpdateTime: {},
  routePolylines: new Map(),
};

const elements = {
  map: document.getElementById('map'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  togglePanelBtn: document.getElementById('togglePanelBtn'),
  sidePanel: document.getElementById('sidePanel'),
  busList: document.getElementById('busList'),
  busSearchInput: document.getElementById('busSearchInput'),
  subscribeAllBtn: document.getElementById('subscribeAllBtn'),
  unsubscribeAllBtn: document.getElementById('unsubscribeAllBtn'),
  shareLocationBtn: document.getElementById('shareLocationBtn'),
  centerMapBtn: document.getElementById('centerMapBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  shareModal: document.getElementById('shareModal'),
  busIdInput: document.getElementById('busIdInput'),
  busRouteInput: document.getElementById('busRouteInput'),
  cancelShareBtn: document.getElementById('cancelShareBtn'),
  confirmShareBtn: document.getElementById('confirmShareBtn'),
};

// ============================================
// Create Custom Bus Icon
// ============================================

function createBusIcon(busId, color) {
  return L.divIcon({
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: ${color};
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        border: 3px solid white;
        position: relative;
        transform: rotate(0deg);
      ">
        <i class="fas fa-bus" style="
          color: white;
          font-size: 18px;
        "></i>
        <div style="
          position: absolute;
          top: -18px;
          background: ${color};
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        ">
          ${busId}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -30],
    className: 'bus-icon',
  });
}

function createUserBusIcon() {
  return L.divIcon({
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 45px;
        height: 45px;
        background: #4caf50;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.5);
        border: 3px solid white;
        animation: pulse-user 1s infinite;
      ">
        <i class="fas fa-location-dot" style="
          color: white;
          font-size: 20px;
        "></i>
      </div>
      <style>
        @keyframes pulse-user {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      </style>
    `,
    iconSize: [45, 45],
    iconAnchor: [22.5, 22.5],
    popupAnchor: [0, -30],
    className: 'user-bus-icon',
  });
}

// ============================================
// Fetch Route from OSRM
// ============================================

async function fetchRouteFromOSRM(waypoints) {
  try {
    // Convert waypoints to OSRM format: lng,lat;lng,lat;...
    const coordString = waypoints
      .map((point) => `${point.lng},${point.lat}`)
      .join(';');

    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`
    );

    if (!response.ok) {
      throw new Error('OSRM request failed');
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coordinates = route.geometry.coordinates;

      // Convert from [lng, lat] to [lat, lng]
      return coordinates.map((coord) => [coord[1], coord[0]]);
    }
  } catch (error) {
    console.error('Error fetching route from OSRM:', error);
    // Fallback to direct waypoints if OSRM fails
    return waypoints.map((point) => [point.lat, point.lng]);
  }
}

// ============================================
// Draw Route Polylines
// ============================================

async function drawRoutePolylines() {
  for (const [busId, waypoints] of Object.entries(fullRouteWaypoints)) {
    try {
      const routeCoordinates = await fetchRouteFromOSRM(waypoints);
      const color = routeMetadata[busId].color;

      const polyline = L.polyline(routeCoordinates, {
        color: color,
        weight: 3,
        opacity: 0.3,
        dashArray: '5, 5',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(appState.map);

      appState.routePolylines.set(busId, polyline);
    } catch (error) {
      console.error(`Failed to draw route for ${busId}:`, error);
    }
  }
}

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeMap();
  drawRoutePolylines();
  initializeSocket();
  setupEventListeners();
  updateConnectionStatus(false);
});

// ============================================
// Map Initialization
// ============================================

function initializeMap() {
  appState.map = L.map('map').setView(MARRAKECH_CENTER, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 10,
  }).addTo(appState.map);

  // Add Marrakech center marker
  L.marker(MARRAKECH_CENTER, {
    icon: L.icon({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    }),
  })
    .addTo(appState.map)
    .bindPopup('<b>Marrakech</b><br>City Center');

  appState.map.on('click', () => closePanel());
}

// ============================================
// Socket.io Initialization
// ============================================

function initializeSocket() {
  appState.socket = io();

  appState.socket.on('connect', () => {
    console.log('Connected:', appState.socket.id);
    updateConnectionStatus(true);
    showNotification('Connected to bus tracking server', 'success');
  });

  appState.socket.on('disconnect', () => {
    console.log('Disconnected');
    updateConnectionStatus(false);
    showNotification('Disconnected from server', 'error');
  });

  appState.socket.on('bus-location', (data) => {
    updateBusMarker(data);
  });

  appState.socket.on('subscription-confirmed', (data) => {
    appState.subscribedBuses.add(data.busId);
  });

  appState.socket.on('unsubscription-confirmed', (data) => {
    appState.subscribedBuses.delete(data.busId);
    removeBusMarker(data.busId);
  });

  appState.socket.on('error', (error) => {
    console.error('Socket error:', error);
    showNotification('Connection error', 'error');
  });
}

// ============================================
// Event Listeners Setup
// ============================================

function setupEventListeners() {
  elements.togglePanelBtn.addEventListener('click', togglePanel);
  elements.busSearchInput.addEventListener('input', filterBusList);
  elements.subscribeAllBtn.addEventListener('click', subscribeToAllBuses);
  elements.unsubscribeAllBtn.addEventListener('click', unsubscribeFromAllBuses);
  elements.centerMapBtn.addEventListener('click', centerMap);
  elements.zoomInBtn.addEventListener('click', () => appState.map.zoomIn());
  elements.zoomOutBtn.addEventListener('click', () => appState.map.zoomOut());
  elements.shareLocationBtn.addEventListener('click', openShareModal);
  elements.cancelShareBtn.addEventListener('click', closeShareModal);
  elements.confirmShareBtn.addEventListener('click', confirmShare);
  elements.shareModal.addEventListener('click', (e) => {
    if (e.target === elements.shareModal) closeShareModal();
  });
  elements.busIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmShare();
  });
}

// ============================================
// Connection Status
// ============================================

function updateConnectionStatus(isConnected) {
  if (isConnected) {
    elements.statusDot.classList.add('connected');
    elements.statusText.textContent = 'Connected';
  } else {
    elements.statusDot.classList.remove('connected');
    elements.statusText.textContent = 'Disconnected';
  }
}

// ============================================
// Bus Marker Management
// ============================================

function updateBusMarker(data) {
  const { busId, latitude, longitude, speed = 0, route = '' } = data;
  const color = busColors[busId] || '#667eea';

  if (appState.busMarkers.has(busId)) {
    const busData = appState.busMarkers.get(busId);
    busData.marker.setLatLng([latitude, longitude]);
    busData.data = data;
  } else {
    const marker = L.marker([latitude, longitude], { icon: createBusIcon(busId, color) })
      .addTo(appState.map)
      .bindPopup(createBusPopup(data));
    appState.busMarkers.set(busId, { marker, data });
  }

  appState.lastUpdateTime[busId] = new Date();
  updateBusList();
}

function removeBusMarker(busId) {
  if (appState.busMarkers.has(busId)) {
    const { marker } = appState.busMarkers.get(busId);
    appState.map.removeLayer(marker);
    appState.busMarkers.delete(busId);
  }
  updateBusList();
}

function clearAllBusMarkers() {
  appState.busMarkers.forEach(({ marker }) => {
    appState.map.removeLayer(marker);
  });
  appState.busMarkers.clear();
  updateBusList();
}

// ============================================
// Bus List UI
// ============================================

function updateBusList() {
  const container = elements.busList;

  if (appState.busMarkers.size === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fas fa-bus"></i></div>
        <p>No buses available</p>
        <small>Click "Watch All" to track buses</small>
      </div>
    `;
    return;
  }

  const searchTerm = elements.busSearchInput.value.toLowerCase();
  const filtered = Array.from(appState.busMarkers.entries())
    .filter(([busId]) => busId.toLowerCase().includes(searchTerm))
    .sort((a, b) => a[0].localeCompare(b[0]));

  container.innerHTML = filtered
    .map(([busId, { data }]) => createBusListItem(busId, data))
    .join('');

  document.querySelectorAll('.bus-item').forEach((item) => {
    item.addEventListener('click', () => {
      const busId = item.dataset.busId;
      const { marker } = appState.busMarkers.get(busId);
      appState.map.setView(marker.getLatLng(), 16);
      marker.openPopup();
    });
  });
}

function createBusListItem(busId, data) {
  const { latitude = 0, longitude = 0, speed = 0, route = '' } = data;
  const updateTime = appState.lastUpdateTime[busId];
  const timeAgo = updateTime ? getTimeAgo(updateTime) : 'Unknown';
  const color = busColors[busId] || '#667eea';

  return `
    <div class="bus-item" data-bus-id="${busId}">
      <div class="bus-item-header">
        <span class="bus-id">
          <div class="bus-color-dot" style="background: ${color};"></div>
          <i class="fas fa-bus"></i> ${busId}
        </span>
        <span class="bus-speed">${Math.round(speed)} km/h</span>
      </div>
      <div class="bus-location">📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}</div>
      ${route ? `<div class="bus-location">🛣️ ${route}</div>` : ''}
      <div class="bus-time">Last update: ${timeAgo}</div>
    </div>
  `;
}

function filterBusList() {
  updateBusList();
}

function createBusPopup(data) {
  const { busId, latitude = 0, longitude = 0, speed = 0, route = '' } = data;
  const time = new Date().toLocaleTimeString();
  const metadata = routeMetadata[busId];

  return `
    <div style="min-width: 240px;">
      <strong style="font-size: 16px;">🚌 ${busId}</strong>
      ${metadata ? `<div style="font-size: 11px; color: #999; margin-top: 2px;">${metadata.description}</div>` : ''}
      <div style="margin-top: 10px; font-size: 12px; color: #666;">
        <p>📍 <strong>Location:</strong><br>${latitude.toFixed(4)}, ${longitude.toFixed(4)}</p>
        <p>🚗 <strong>Speed:</strong> ${Math.round(speed)} km/h</p>
        ${route ? `<p>🛣️ <strong>Route:</strong><br>${route}</p>` : ''}
        <p>⏰ <strong>Updated:</strong> ${time}</p>
      </div>
    </div>
  `;
}

// ============================================
// User Bus (Share Location)
// ============================================

function openShareModal() {
  elements.shareModal.classList.add('show');
  elements.busIdInput.focus();
}

function closeShareModal() {
  elements.shareModal.classList.remove('show');
  elements.busIdInput.value = '';
  elements.busRouteInput.value = '';
}

function confirmShare() {
  const busId = elements.busIdInput.value.trim();
  if (!busId) {
    showNotification('Please enter a bus ID', 'error');
    return;
  }
  const route = elements.busRouteInput.value.trim();
  closeShareModal();
  startSharingLocation(busId, route);
}

function startSharingLocation(busId, route = '') {
  if (!navigator.geolocation) {
    showNotification('Geolocation not supported', 'error');
    return;
  }

  appState.isShareingLocation = true;
  appState.userBus = { busId, route };
  elements.shareLocationBtn.classList.add('active');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      sendLocationUpdate(position, busId, route);

      appState.watchPositionId = navigator.geolocation.watchPosition(
        (position) => sendLocationUpdate(position, busId, route),
        (error) => {
          console.error('Geolocation error:', error);
          showNotification('Unable to get location', 'error');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );

      showNotification(`Sharing location as bus ${busId}`, 'success');
    },
    (error) => {
      console.error('Geolocation error:', error);
      showNotification('Permission denied', 'error');
      appState.isShareingLocation = false;
      elements.shareLocationBtn.classList.remove('active');
    }
  );
}

function sendLocationUpdate(position, busId, route) {
  const { latitude, longitude, accuracy } = position.coords;
  const speed = position.coords.speed ? position.coords.speed * 3.6 : 0;

  if (!appState.userBus || !appState.userBus.marker) {
    const marker = L.marker([latitude, longitude], { icon: createUserBusIcon() })
      .addTo(appState.map)
      .bindPopup(`<b>📍 Your Bus: ${busId}</b>`);
    if (appState.userBus) appState.userBus.marker = marker;
  } else {
    appState.userBus.marker.setLatLng([latitude, longitude]);
  }

  appState.socket.emit('bus-location-update', {
    busId,
    latitude: Math.round(latitude * 10000) / 10000,
    longitude: Math.round(longitude * 10000) / 10000,
    speed: Math.round(speed * 10) / 10,
    accuracy,
    route,
    timestamp: Date.now(),
  });
}

function stopSharingLocation() {
  if (appState.watchPositionId !== null) {
    navigator.geolocation.clearWatch(appState.watchPositionId);
    appState.watchPositionId = null;
  }
  if (appState.userBus && appState.userBus.marker) {
    appState.map.removeLayer(appState.userBus.marker);
  }
  appState.isShareingLocation = false;
  appState.userBus = null;
  elements.shareLocationBtn.classList.remove('active');
  showNotification('Stopped sharing location', 'info');
}

// ============================================
// Subscribe/Unsubscribe
// ============================================

function subscribeToAllBuses() {
  ['Ligne 1', 'Ligne 12', 'Ligne 6'].forEach((busId) => {
    appState.socket.emit('subscribe-bus', busId);
  });
  showNotification('Watching all 3 bus lines', 'success');
}

function unsubscribeFromAllBuses() {
  appState.subscribedBuses.forEach((busId) => {
    appState.socket.emit('unsubscribe-bus', busId);
  });
  clearAllBusMarkers();
  appState.subscribedBuses.clear();
  showNotification('Stopped watching all buses', 'info');
}

// ============================================
// Map Controls
// ============================================

function centerMap() {
  appState.map.setView(MARRAKECH_CENTER, DEFAULT_ZOOM);
}

// ============================================
// Panel Controls
// ============================================

function togglePanel() {
  elements.sidePanel.classList.toggle('open');
}

function closePanel() {
  elements.sidePanel.classList.remove('open');
}

// ============================================
// Notifications
// ============================================

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// Utility Functions
// ============================================

function getTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return date.toLocaleTimeString();
}
