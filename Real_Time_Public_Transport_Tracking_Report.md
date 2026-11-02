# CAPSTONE PROJECT REPORT
**(Project Term January-May 2026)**

## Real-Time Public Transport Tracking for Small Cities

Submitted by  
Project Group Number: ____________________  
Course Code: CSE439  

Under the Guidance of  
Mentor Name: ____________________  
Designation: Assistant Professor  
School of Computer Science and Engineering  
Lovely Professional University  
Phagwara, Punjab - 144411

Team Members  
1. Nitin Singh - ____________________  
2. Yash Gupta - ____________________  
3. Priyanshu Dadich - ____________________  
4. Anish Mishra - ____________________  
5. Priyanshu Kumar - ____________________  
6. Gautam Kumar - ____________________

---

## DECLARATION
We hereby declare that the project work entitled **"Real-Time Public Transport Tracking for Small Cities"** is an authentic record of our own work carried out as a requirement of the Capstone Project for the award of the B.Tech degree in Computer Science and Engineering from Lovely Professional University, Phagwara.

All information presented in this report is based on our implementation, testing, and analysis of the developed system. No part of this report has been submitted elsewhere for any other degree or diploma.

---

## CERTIFICATE
This is to certify that the project report titled **"Real-Time Public Transport Tracking for Small Cities"** has been prepared by the above-mentioned students under my guidance and supervision.

To the best of my knowledge, the work presented is original and satisfies the requirements for the award of B.Tech degree in Computer Science and Engineering.

Mentor Signature: ____________________  
Date: ____________________

---

## ACKNOWLEDGEMENT
We express sincere gratitude to our project mentor, faculty members, and School of Computer Science and Engineering for their guidance and support throughout this capstone.

We also thank our teammates for collaborative development and testing, and our families and friends for encouragement during project execution.

---

## TABLE OF CONTENTS
1. Introduction  
2. Profile of the Problem, Rationale and Scope of the Study  
3. Existing System  
4. Problem Analysis  
5. Software Requirement Analysis  
6. Design  
7. Testing  
8. Implementation  
9. Project Legacy  
10. User Manual  
11. Source Code and System Snapshots  
12. Bibliography

---

## 1. INTRODUCTION

### 1.1 Background of the Study
Small and medium cities often operate public buses without reliable digital tracking infrastructure. Commuters do not get dependable real-time bus status, while transport administrators lack a consolidated operational view of active vehicles, trips, and incidents.

### 1.2 About the Project
This project delivers a multi-application transport tracking platform with:
- A **backend API** for authentication, fleet, trip, and location workflows.
- A **driver mobile app** (Expo React Native) for trip start/end, breakdown reporting, and periodic GPS updates.
- A **user web app** (React + Vite) for public live bus tracking on maps with route filtering.
- An **admin panel** (React + Vite) for administrative fleet and operations control.

The platform uses Socket.IO to broadcast live location and trip events and MongoDB for persistent operational data.

### 1.3 Objectives
1. Provide real-time bus location visibility to passengers.  
2. Digitize trip lifecycle management (start, active, end, breakdown).  
3. Enable route-level and bus-level tracking with map visualization.  
4. Provide admin control over buses, drivers, assignment, and status.  
5. Ensure secure role-based authentication for admin, driver, and user access.  
6. Build a scalable low-cost architecture suitable for small city deployment.

### 1.4 Scope
In scope:
- Live GPS-based location updates from drivers.
- Real-time map updates for commuters.
- Fleet and trip administration.
- Public route and active bus endpoints.

Out of scope:
- Predictive ETA model using traffic and historical congestion.
- Payment and ticketing integration.
- Hardware IoT integration beyond mobile GPS.

---

## 2. PROFILE OF THE PROBLEM, RATIONALE AND SCOPE OF THE STUDY

### 2.1 Problem Statement
Public transport in small cities suffers from visibility and reliability gaps. Passengers cannot see where buses are in real time. Authorities cannot monitor active operations efficiently. Manual coordination increases service delays and user dissatisfaction.

### 2.2 Key Problems Identified
- No centralized live tracking for buses.
- No transparent trip lifecycle monitoring.
- Weak operational insight for authorities.
- No structured incident reporting mechanism.
- High commuter uncertainty and waiting time.

### 2.3 Rationale for the Study
The project addresses a practical urban mobility problem with a software-first, low-infrastructure approach using commodity smartphones (GPS), cloud APIs, and web/mobile clients. This is suitable for resource-constrained deployments and can be expanded incrementally.

### 2.4 Scope of the Study
The study covers analysis, design, implementation, and validation of a real-time bus tracking platform integrating backend, mobile driver app, and web tracking interfaces.

---

## 3. EXISTING SYSTEM

### 3.1 Introduction
Traditional bus operations in many small cities rely on static schedules, verbal updates, and disconnected records. These methods do not provide live service intelligence.

### 3.2 Existing Software/Approaches
- Static timetable boards or paper schedules.
- Manual phone-based supervisor-driver coordination.
- Generic map sharing without integrated fleet workflows.

### 3.3 Present System Limitations
- No real-time data synchronization.
- No structured historical location repository.
- No role-based multi-stakeholder software flow.
- No public route-wise bus discovery endpoint.

### 3.4 What Is New in the Developed System
- Driver-authenticated trip start/end APIs.
- Periodic GPS push from mobile app.
- WebSocket location streaming to clients.
- Public active bus and route listing APIs.
- Admin controls for fleet assignment and state transitions.
- Breakdown reporting integrated into trip operations.

---

## 4. PROBLEM ANALYSIS

### 4.1 Product Definition
The developed product is a distributed transport tracking system comprising:
- **Backend** (`Node.js`, `Express`, `MongoDB`, `Socket.IO`)
- **Driver App** (`Expo`, `React Native`, `expo-location`, `expo-task-manager`)
- **User Tracker App** (`React`, `Leaflet`, `Socket.IO client`)
- **Admin App** (`React`, role-protected APIs)

### 4.2 Feasibility Analysis

#### 4.2.1 Technical Feasibility
The system uses widely adopted open-source components and modular REST APIs. GPS and network capabilities required by the driver app are available on standard Android devices.

#### 4.2.2 Operational Feasibility
Drivers follow simple start/end trip flow; users consume a passive live map interface; administrators manage fleet entities through standard CRUD and assignment workflows.

#### 4.2.3 Economic Feasibility
The stack is open-source. Initial deployment can run on low-cost cloud instances with MongoDB free/low tiers for pilot phases.

### 4.3 Project Plan (Indicative)
1. Requirements and architecture finalization  
2. Data model and API contract design  
3. Backend implementation  
4. Driver app integration  
5. User tracking app integration  
6. Testing and documentation

---

## 5. SOFTWARE REQUIREMENT ANALYSIS

### 5.1 Introduction
This chapter defines functional and non-functional requirements validated against actual source code behavior.

### 5.2 General Description

#### 5.2.1 Product Perspective
The system is a multi-client architecture:
- Driver app sends location and trip signals.
- Backend validates, stores, and broadcasts.
- User web app consumes public APIs and WebSocket updates.
- Admin interfaces access protected management endpoints.

#### 5.2.2 Product Functions
- Authentication for admin/driver/user roles.
- Bus and driver management.
- Driver-bus assignment.
- Trip start, end, and breakdown reporting.
- Live location capture and history.
- Public active bus map feed and route feed.

#### 5.2.3 User Characteristics
- **Commuter users:** minimal technical skills; consume map-based UI.
- **Drivers:** smartphone users; perform operational actions.
- **Admins:** operations staff managing fleet records.

### 5.3 Specific Requirements

#### 5.3.1 Functional Requirements
1. System shall authenticate admin, driver, and user independently.  
2. Driver shall be able to start a trip only when assigned to a bus.  
3. Driver shall be able to end an active trip with end coordinates.  
4. Driver shall be able to report breakdown with reason.  
5. Location API shall accept lat/lng, tripId, speed, and heading.  
6. Backend shall persist each location update in location collection.  
7. Backend shall update `bus.currentLocation` on each valid location update.  
8. Backend shall emit `location-update` via Socket.IO.  
9. Public API shall provide active/breakdown buses with optional route filter.  
10. Public API shall provide route list for client-side filtering.

#### 5.3.2 Non-Functional Requirements
- **Security:** JWT-protected role routes.
- **Performance:** low-latency location write and event emission.
- **Scalability:** WebSocket room model per bus.
- **Reliability:** resilient mobile location loop and background task support.
- **Maintainability:** modular routes/models/middleware.

#### 5.3.3 Hardware Requirements
- Driver smartphone with GPS and internet.
- Admin/user devices with modern browser.
- Cloud/hosted server and MongoDB instance.

#### 5.3.4 Software Requirements
- Node.js, npm
- Express, Mongoose, Socket.IO
- React + Vite (web apps)
- Expo SDK 49 + React Native 0.72 (mobile apps)
- MongoDB

---

## 6. DESIGN

### 6.1 System Design
The architecture follows layered flow:
1. **Vehicle Layer:** Driver mobile app obtains GPS data.  
2. **Communication Layer:** HTTPS and WebSockets transfer events/data.  
3. **Cloud Processing Layer:** Express API validates and persists operational data.  
4. **Application Layer:** Admin and commuter interfaces consume processed data.

### 6.2 Design Notations

#### 6.2.1 Database Schema - Bus
Key fields: `busNumber`, `plateNumber`, `capacity`, `route`, `routeCoordinates`, `assignedDriver`, `status`, `currentLocation`.

#### 6.2.2 Database Schema - Trip
Key fields: `bus`, `driver`, `startTime`, `endTime`, `status`, `startLocation`, `endLocation`, `breakdownReported`, `breakdownReason`.

#### 6.2.3 Database Schema - Location
Key fields: `trip`, `bus`, `driver`, `coordinates`, `speed`, `heading`, `timestamp`.
Indexed by `(trip, timestamp)` and `(bus, timestamp)` for history queries.

### 6.3 Detailed Design
- `server.js` initializes REST + Socket.IO and route mounting.
- `routes/location.js` handles location ingestion, validation, and event emission.
- `routes/trip.js` manages start/end/breakdown transitions.
- `routes/public.js` serves route and active bus feeds.
- Driver app sends periodic updates every 5 seconds and supports background tracking.
- User app subscribes to bus updates and renders live markers + polylines.

### 6.4 Flowcharts (to include in final DOC/PDF)
1. Driver Login -> Start Trip -> Send Location -> End Trip  
2. Driver Breakdown Reporting Flow  
3. User Route Filter and Live Tracking Flow

### 6.5 Pseudocode
**Location Update Flow**
1. Validate token and request payload  
2. Verify trip ownership and status=active  
3. Insert location record  
4. Update bus current location  
5. Emit WebSocket `location-update`

---

## 7. TESTING

### 7.1 Functional Testing (Representative)
- Driver login with valid and invalid credentials.
- Start trip without assigned bus (expected failure).
- Start trip with assigned bus (expected success).
- Location update with inactive trip (expected rejection).
- Active bus retrieval with and without route filter.
- Breakdown reporting and status propagation.

### 7.2 Structural Testing
Route-level validation and branch conditions were reviewed in:
- Auth routes (`/admin/login`, `/driver/login`, `/user/login`)
- Trip transitions (`/start`, `/:id/end`, `/:id/breakdown`)
- Location ingestion checks for active trip and ownership

### 7.3 Levels of Testing
- Unit-level validation of model and route constraints.
- Integration testing across mobile app -> API -> DB -> WebSocket.
- System testing with all clients running simultaneously.

### 7.4 Test Environment
- Backend: Node server on port 5000.
- Web apps: local Vite dev servers.
- Driver app: Expo runtime on Android emulator/device.

---

## 8. IMPLEMENTATION

### 8.1 Implementation of the Project

#### 8.1.1 Backend Implementation
Implemented API groups:
- `/api/auth`
- `/api/buses`
- `/api/drivers`
- `/api/trips`
- `/api/locations`
- `/api/public`

Socket.IO events:
- `location-update`
- `trip-started`
- `trip-ended`
- `breakdown-alert`

#### 8.1.2 Frontend/Mobile Implementation
- **User app:** route filter, active bus list, Leaflet map markers, route polyline.
- **Driver app:** start trip, end trip, breakdown report, periodic and background location push.
- **Admin app:** fleet management workflows via protected endpoints.

### 8.2 Conversion Plan
Pilot rollout recommendation:
1. Configure buses and driver assignments.
2. Train drivers on start/end/breakdown flows.
3. Launch user tracker for selected routes.
4. Expand route coverage based on pilot stability.

### 8.3 Post-Implementation and Maintenance
- Add observability dashboards and API latency tracking.
- Introduce ETA prediction service.
- Add alerting for stale bus location updates.
- Harden deployment with CI/CD and environment separation.

---

## 9. PROJECT LEGACY

### 9.1 Current Status of the Project
The core real-time tracking pipeline is implemented and operational:
driver GPS updates -> backend storage -> WebSocket broadcast -> user map updates.

### 9.2 Remaining Areas of Concern
- ETA prediction logic currently basic/not included as ML model.
- Network instability can affect update frequency.
- Public users are read-only; advanced user features can be added later.

### 9.3 Technical and Managerial Lessons Learnt
- Event-driven architecture reduces polling overhead.
- Route ownership checks are essential for secure location writes.
- Clear API contract between mobile and backend reduces integration friction.

---

## 10. USER MANUAL

### 10.1 System Setup and Installation

#### 10.1.1 Prerequisites
- Node.js v18 or later (npm is installed with Node.js).
- MongoDB Atlas URI or local MongoDB Community Server.
- Google Chrome 90+, Mozilla Firefox 88+, or Microsoft Edge 90+.
- Expo Go (for quick driver app testing) or Android Studio/iOS simulator for emulator testing.
- Internet connectivity for map tiles (OpenStreetMap) and real-time socket communication.

#### 10.1.2 Backend Setup
1. Open a terminal and move to backend:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `backend/.env`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/transport_tracking
   JWT_SECRET=your_super_secret_jwt_key_change_this
   NODE_ENV=development
   ```
4. Start the API server:
   ```bash
   npm run dev
   ```
5. Verify startup logs:
   - `MongoDB connected successfully`
   - `Server running on port 5000`
6. Optional health check: open `http://localhost:5000/api/health`.
7. (Initial setup only) create default admin:
   ```bash
   curl -X POST http://localhost:5000/api/auth/admin/create-default
   ```
   Default credentials:
   - Email: `admin@transport.com`
   - Password: `admin123`

#### 10.1.3 Frontend Setup
1. Open a second terminal for Admin Panel:
   ```bash
   cd admin-panel
   npm install
   npm run dev
   ```
2. Open the admin panel URL shown by Vite (typically `http://localhost:3000`).
3. If needed, set API URL in `admin-panel/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
4. Open a third terminal for User Web Tracker:
   ```bash
   cd user-app
   npm install
   npm run dev
   ```
5. Open the user app URL shown by Vite (commonly `http://localhost:3001`).
6. For local backend testing, optionally create `user-app/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```

#### 10.1.4 Driver App Setup
1. Open another terminal and go to driver app:
   ```bash
   cd driver-app
   npm install
   npm start
   ```
2. Configure backend base URL in `driver-app/utils/api.js` for your environment:
   - Android emulator: `http://10.0.2.2:5000/api`
   - iOS simulator: `http://localhost:5000/api`
   - Physical device: `http://<your-computer-ip>:5000/api`
3. Ensure location permissions are granted when prompted in the app.
4. For release Android builds, set Google Maps key in `driver-app/app.json`:
   - `expo.android.config.googleMaps.apiKey`
5. Run on device/emulator:
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Or scan QR in Expo Go

### 10.2 Commuter User Guide
The commuter (public) app is a read-only live tracking interface. No login is required.

#### 10.2.1 Open the tracker
1. Open the User App in browser (for local setup, use the Vite URL from `user-app`).
2. The **Live Bus Tracker** page loads with route filter, map, and active buses list.

#### 10.2.2 Filter buses by route
1. In the **Route** dropdown, select a route name.
2. The app reloads active buses for that route.
3. To clear filtering, choose **All Active Routes**.
4. Click **Refresh** to manually fetch latest active bus set.

#### 10.2.3 View buses on map and list
1. Colored markers show bus status:
   - Green: active
   - Red: breakdown
2. Click any marker or list item to select a bus.
3. A popup displays bus number, route, and status.
4. When available, selected bus route polyline is drawn on map.
5. Last update timestamp appears in bus list cards.

#### 10.2.4 Real-time behavior
1. The app receives updates through Socket.IO from backend.
2. When trips start/end or breakdowns are reported, the bus list refreshes automatically.
3. Location updates are reflected live without manual page reload.

### 10.3 Driver User Guide
#### 10.3.1 Login as driver
1. Open the driver app (Expo build).
2. Enter assigned driver email and password.
3. On successful login, the Home screen opens.

#### 10.3.2 Start a trip
1. Ensure admin has assigned a bus to your account.
2. Tap **Start Trip**.
3. The app fetches current GPS and calls `/api/trips/start`.
4. Trip status changes to active and tracking starts.

#### 10.3.3 Live tracking during trip
1. Keep location services enabled.
2. Foreground updates are sent every 5 seconds.
3. Background location task continues sending updates when app is minimized.
4. Home screen shows trip details (bus number, route, start time, tracking status).

#### 10.3.4 Report breakdown
1. Tap **Report Breakdown**.
2. Enter reason when prompted.
3. Backend records breakdown and pushes `breakdown-alert` event.
4. Bus status is updated to breakdown for admin and public users.

#### 10.3.5 End a trip
1. Tap **End Trip**.
2. Confirm action in prompt.
3. Current GPS is sent to `/api/trips/:id/end`.
4. Trip moves to completed, bus becomes inactive, and tracking stops.

### 10.4 Admin Panel User Guide

#### 10.4.1 Login
1. Open Admin Panel URL.
2. Login using admin credentials.
3. On success, Dashboard opens with system overview cards.

#### 10.4.2 Bus management
1. Go to **Buses**.
2. Click **Add Bus** to create a bus (number, plate, capacity, route).
3. Use edit/delete icons for updates and removal.
4. Click **Assign Driver** to map a driver to a bus.

#### 10.4.3 Driver management
1. Go to **Drivers**.
2. Click **Add Driver** and enter name, email, phone, license number, and password.
3. Update driver profile as needed.
4. Delete inactive/outdated driver records when required.

#### 10.4.4 Live map and analytics
1. Open **Live Map** to monitor active buses and their current locations.
2. Click a bus from sidebar or marker to inspect details.
3. Open **Analytics** to review trip history.
4. Apply date/status filters and analyze completed, active, and breakdown trips.

---

## 11. SOURCE CODE AND SYSTEM SNAPSHOTS

### 11.1 Repository Structure (Current)
- `backend/` - APIs, models, middleware, Socket.IO server
- `user-app/` - public live tracking UI
- `driver-app/` - driver mobile workflow and GPS transmission
- `admin-panel/` - admin operations UI
- `user-mobile-app/` - user mobile client (Expo-based companion app)

### 11.2 Key Source Code References
1. `backend/server.js` - API + Socket.IO bootstrap  
2. `backend/routes/location.js` - location write and broadcast  
3. `backend/routes/trip.js` - trip lifecycle management  
4. `backend/routes/public.js` - public active buses/routes feed  
5. `driver-app/screens/HomeScreen.js` - trip controls + periodic updates  
6. `driver-app/utils/location.js` - background task location streaming  
7. `user-app/src/App.jsx` - live map rendering and socket subscription

### 11.3 System Snapshots (to add)
- Driver login screen
- Driver active trip screen
- User live map with active buses
- Admin bus management view
- Route filter and selected bus details

---

## 12. BIBLIOGRAPHY
1. Zhou, P., Zheng, Y., Li, M. (2012). *How Long to Wait? Predicting Bus Arrival Time with Mobile Phone Based Participatory Sensing*.  
2. Biagioni, J., et al. (2011). *EasyTracker: Automatic Transit Tracking, Mapping, and Arrival Time Prediction Using Smartphones*.  
3. Hu, H., Liu, Y., Wang, J. (2011). *Real-Time Bus Arrival Time Prediction Using GPS Data*.  
4. Express.js Documentation. https://expressjs.com  
5. Mongoose Documentation. https://mongoosejs.com/docs  
6. Socket.IO Documentation. https://socket.io/docs  
7. React Documentation. https://react.dev  
8. Expo Documentation. https://docs.expo.dev  
9. Leaflet Documentation. https://leafletjs.com  
10. MongoDB Atlas Documentation. https://www.mongodb.com/docs/atlas

---

## Notes for Final University Submission
This report is structured to match the chapter style of your reference report. Before final PDF generation, replace placeholders (mentor, registration numbers, group number), add institution-specific forms/signature pages, and insert actual screenshots/figures where marked.
