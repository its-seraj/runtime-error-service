const express = require('express');
const cors = require('cors');
const path = require('path');
const errorRoutes = require('./routes/errors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static interactive frontend
app.use(express.static(path.join(__dirname, 'public')));

// Health & System Metrics
app.get('/health', (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    pid: process.pid,
    memory: {
      rssMb: (memory.rss / (1024 * 1024)).toFixed(2),
      heapTotalMb: (memory.heapTotal / (1024 * 1024)).toFixed(2),
      heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(2),
      externalMb: (memory.external / (1024 * 1024)).toFixed(2),
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount error routes under /api/errors
app.use('/api/errors', errorRoutes);

// Fallback 404 for undefined routes
app.use((req, res, next) => {
  const error = new Error(`Resource '${req.originalUrl}' not found.`);
  error.statusCode = 404;
  error.errorCode = 'ERR_ROUTE_NOT_FOUND';
  next(error);
});

// Global Express Error Handling Middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  console.error(`[Express Error Handler] [${req.method} ${req.originalUrl}] -> ${err.name}: ${err.message}`);

  // Dispatches error to FixForge webhook asynchronously
  try {
    const http = require('http');
    const webhookData = JSON.stringify({
      message: `${err.name || 'Error'}: ${err.message}`,
      stack: err.stack || '',
      context: { path: req.originalUrl, method: req.method, statusCode },
      source: 'Node.js Runtime Error Testing Lab'
    });
    const postReq = http.request({
      hostname: '127.0.0.1',
      port: 4242,
      path: '/webhook/error',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(webhookData),
        'x-fixforge-secret': '1af5d8f191b5de4ab4c8418ec5b2c1e2dd07cc45303b1b6f'
      },
      timeout: 1000
    });
    postReq.on('error', () => {});
    postReq.write(webhookData);
    postReq.end();
  } catch {}

  res.status(statusCode).json({
    success: false,
    error: {
      type: err.constructor?.name || 'Error',
      name: err.name || 'RuntimeError',
      code: err.code || err.errorCode || null,
      message: err.message || 'An unexpected runtime error occurred',
      statusCode: statusCode,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      stack: err.stack ? err.stack.split('\n').map((line) => line.trim()) : [],
    },
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Node.js Runtime Error Service is running!`);
  console.log(`🌐 Web UI:       http://localhost:${PORT}`);
  console.log(`📚 API Catalog:  http://localhost:${PORT}/api/errors`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`📋 Error Logs:   http://localhost:${PORT}/api/errors/logs`);
  console.log('====================================================');
});

module.exports = { app, server };
