
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const seatRoutes = require('./routes/seatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const checkInRoutes = require('./routes/checkInRoutes');

const {
  initializeSocket,
} = require('./config/socket');

const {
  startSeatHoldCleanup,
} = require('./services/seatHoldService');

dotenv.config({ path: '../.env' });

const app = express();

// Create one HTTP server for Express and Socket.IO
const httpServer = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
  })
);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/events/:eventId/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/check-in', checkInRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EventHub API is running',
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Initialize Socket.IO after the database connects
    initializeSocket(httpServer);

    // Start automatic expired-seat cleanup
    startSeatHoldCleanup();

    httpServer.listen(PORT, () => {
      console.log(`EventHub API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start EventHub API:', error.message);
    process.exitCode = 1;
  }
};

if (require.main === module) {
  startServer();
}

// Preserve Express app export for existing Supertest tests
module.exports = app;
