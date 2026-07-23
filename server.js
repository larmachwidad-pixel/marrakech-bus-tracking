const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/database');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Simulated Bus Routes Data
const busRoutes = {
  'Ligne 1': {
    name: 'Ligne 1: Medina - Ville Nouvelle',
    route: [
      { lat: 31.6250, lng: -7.9850 },
      { lat: 31.6280, lng: -7.9830 },
      { lat: 31.6310, lng: -7.9810 },
      { lat: 31.6330, lng: -7.9790 },
      { lat: 31.6350, lng: -7.9770 },
      { lat: 31.6330, lng: -7.9750 },
      { lat: 31.6310, lng: -7.9800 },
      { lat: 31.6280, lng: -7.9820 },
    ],
    color: '#667eea',
    speed: 40,
  },
  'Ligne 12': {
    name: 'Ligne 12: Airport - City Center',
    route: [
      { lat: 31.6070, lng: -8.0363 },
      { lat: 31.6150, lng: -8.0250 },
      { lat: 31.6200, lng: -8.0100 },
      { lat: 31.6250, lng: -7.9950 },
      { lat: 31.6295, lng: -7.9811 },
      { lat: 31.6200, lng: -7.9950 },
      { lat: 31.6150, lng: -8.0100 },
      { lat: 31.6100, lng: -8.0200 },
    ],
    color: '#764ba2',
    speed: 60,
  },
  'Ligne 6': {
    name: 'Ligne 6: Safi Road - Kasbah',
    route: [
      { lat: 31.5950, lng: -7.9700 },
      { lat: 31.6000, lng: -7.9750 },
      { lat: 31.6100, lng: -7.9800 },
      { lat: 31.6200, lng: -7.9850 },
      { lat: 31.6300, lng: -7.9900 },
      { lat: 31.6400, lng: -7.9950 },
      { lat: 31.6300, lng: -7.9850 },
      { lat: 31.6200, lng: -7.9750 },
      { lat: 31.6100, lng: -7.9700 },
    ],
    color: '#f44336',
    speed: 35,
  },
};

const simulatedBuses = {};

// Initialize simulated buses
Object.keys(busRoutes).forEach((busId) => {
  simulatedBuses[busId] = {
    busId,
    routeIndex: 0,
    currentLat: busRoutes[busId].route[0].lat,
    currentLng: busRoutes[busId].route[0].lng,
    speed: busRoutes[busId].speed,
  };
});

// Helper function to save location to SQLite
function saveBusLocationToDB(busId, lat, lng, speed, routeName) {
  const insertBus = `
    INSERT INTO buses (id, name, color, speed, last_lat, last_lng, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      speed = excluded.speed,
      last_lat = excluded.last_lat,
      last_lng = excluded.last_lng,
      updated_at = CURRENT_TIMESTAMP;
  `;
  db.run(insertBus, [busId, routeName || busId, busRoutes[busId]?.color || '#333333', speed, lat, lng]);

  const insertHistory = `
    INSERT INTO location_history (bus_id, lat, lng, speed)
    VALUES (?, ?, ?, ?);
  `;
  db.run(insertHistory, [busId, lat, lng, speed]);
}

// REST Endpoints
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to retrieve all bus history from SQLite
app.get('/api/history', (req, res) => {
  db.all('SELECT * FROM location_history ORDER BY recorded_at DESC LIMIT 50', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ history: rows });
  });
});

// Update bus positions and persist to database
function updateBusPositions() {
  Object.keys(simulatedBuses).forEach((busId) => {
    const bus = simulatedBuses[busId];
    const route = busRoutes[busId].route;

    bus.routeIndex = (bus.routeIndex + 1) % route.length;
    const nextWaypoint = route[bus.routeIndex];

    bus.currentLat = nextWaypoint.lat;
    bus.currentLng = nextWaypoint.lng;

    const busPayload = {
      busId,
      latitude: bus.currentLat,
      longitude: bus.currentLng,
      speed: bus.speed,
      route: busRoutes[busId].name,
      timestamp: Date.now(),
    };

    // Save to SQLite
    saveBusLocationToDB(busId, bus.currentLat, bus.currentLng, bus.speed, busRoutes[busId].name);

    // Broadcast live update
    io.emit('bus-location', busPayload);
  });
}

// Interval loop every 5s
setInterval(updateBusPositions, 5000);

// Socket.io Events
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  Object.keys(simulatedBuses).forEach((busId) => {
    const bus = simulatedBuses[busId];
    socket.emit('bus-location', {
      busId,
      latitude: bus.currentLat,
      longitude: bus.currentLng,
      speed: bus.speed,
      route: busRoutes[busId].name,
      timestamp: Date.now(),
    });
  });

  socket.on('bus-location-update', (data) => {
    saveBusLocationToDB(data.busId, data.latitude, data.longitude, data.speed || 0, data.route);
    io.emit('bus-location', data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚌 Bus Tracking Server running at http://${HOST}:${PORT}`);
  console.log(`💾 SQLite Database connected and recording bus history!`);
});
