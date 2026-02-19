import 'dotenv/config';
import { createApp } from './app';

const PORT = parseInt(process.env.PORT || '4003', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = createApp();

const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║        YMR  API  Gateway  🚀               ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`  Environment : ${NODE_ENV}`);
  console.log(`  Listening   : http://localhost:${PORT}`);
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Gateway] SIGTERM received — shutting down gracefully...');
  server.close(() => {
    console.log('[Gateway] HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Gateway] SIGINT received — shutting down gracefully...');
  server.close(() => {
    console.log('[Gateway] HTTP server closed.');
    process.exit(0);
  });
});
