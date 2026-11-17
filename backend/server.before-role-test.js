const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');


dotenv.config({ path: '../.env' });

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
  })
);

app.use(express.json());
app.use('/api/auth', authRoutes);

// Temporary development endpoint for testing role-based authorization
app.get(
  '/api/organizer-test',
  authMiddleware,
  roleMiddleware('organizer'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Organizer authorization successful',
      user: {
        id: req.user.id,
        role: req.user.role,
      },
    });
  }
);

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

    app.listen(PORT, () => {
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

module.exports = app;