
const { Server } = require('socket.io');

let io;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Join the room for a particular event
    socket.on('joinEvent', (eventId) => {
      if (
        typeof eventId !== 'string' ||
        !/^[a-fA-F0-9]{24}$/.test(eventId)
      ) {
        return;
      }

      const roomName = `event:${eventId}`;

      socket.join(roomName);

      console.log(`${socket.id} joined ${roomName}`);
    });

    // Leave the event room
    socket.on('leaveEvent', (eventId) => {
      if (
        typeof eventId !== 'string' ||
        !/^[a-fA-F0-9]{24}$/.test(eventId)
      ) {
        return;
      }

      socket.leave(`event:${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
};

const getIO = () => io || null;

module.exports = {
  initializeSocket,
  getIO,
};
