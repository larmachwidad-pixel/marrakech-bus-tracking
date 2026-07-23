# 🚌 Marrakech Bus Tracker

A real-time bus tracking web application built for Marrakech, Morocco. It simulates active bus lines using **Node.js**, **Socket.io**, and **Leaflet.js**, featuring live map updates and historical route logging backed by **SQLite**.

---

## 🚀 Features

* **Real-Time Live Map:** Interactive Leaflet map centered on Marrakech displaying active bus routes.
* **Simulated Bus Movements:** Pre-configured bus lines (**Ligne 1**, **Ligne 12**, **Ligne 6**) moving dynamically across city waypoints every 5 seconds.
* **Live GPS Broadcasting:** Allows users to share their current location as a custom bus broadcast via Socket.io.
* **Persistent SQLite Database:** Logs all active buses and records GPS position history in a local SQLite database (`bus_tracker.db`).
* **REST API:** Endpoints to inspect active lines and retrieve historic movement logs.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express, Socket.io, SQLite3
* **Frontend:** HTML5, CSS3, JavaScript (ES6+), Leaflet.js
* **Tooling:** Git, npm

---

## ⚙️ Getting Started

### Prerequisites

* Node.js (v18 or higher recommended)
* npm

### Installation & Running

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/larmachwidad-pixel/marrakech-bus-tracking.git](https://github.com/larmachwidad-pixel/marrakech-bus-tracking.git)
   cd marrakech-bus-tracking
