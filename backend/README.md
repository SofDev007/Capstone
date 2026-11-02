# Backend API - Transport Tracking System

Node.js + Express + MongoDB backend with WebSocket support for real-time location tracking.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/transport_tracking
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
```

3. Start MongoDB (if not running)

4. Create default admin (optional):
```bash
curl -X POST http://localhost:5000/api/auth/admin/create-default
```

5. Start server:
```bash
npm run dev
```

## Default Admin Credentials

- Email: `admin@transport.com`
- Password: `admin123`

## API Documentation

See main README.md for complete API endpoint documentation.

