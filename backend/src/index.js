import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import horseRoutes from './routes/horses.js';
import stableRoutes from './routes/stables.js';
import sessionRoutes from './routes/sessions.js';
import competitionRoutes from './routes/competitions.js';
import billingRoutes from './routes/billing.js';
import notificationRoutes from './routes/notifications.js';
import connectionRoutes from './routes/connections.js';
import contactRoutes from './routes/contact.js';
import uploadRoutes from './routes/uploads.js';

// Services
import { initEmailService, sendEmail, emailTemplates } from './services/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Fastify
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  }
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
});

await fastify.register(cookie);

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  sign: {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  }
});

await fastify.register(multipart, {
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  }
});

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

await fastify.register(fastifyStatic, {
  root: path.resolve(uploadDir),
  prefix: '/uploads/',
  decorateReply: false
});

// Decorate fastify with prisma
fastify.decorate('prisma', prisma);

// Initialize and decorate email service
initEmailService();
fastify.decorate('sendEmail', sendEmail);
fastify.decorate('emailTemplates', emailTemplates);

// Authentication decorator
fastify.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
});

// Optional auth decorator (doesn't fail, just sets user if token exists)
fastify.decorate('optionalAuth', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    request.user = null;
  }
});

// Register routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(userRoutes, { prefix: '/api/users' });
fastify.register(horseRoutes, { prefix: '/api/horses' });
fastify.register(stableRoutes, { prefix: '/api/stables' });
fastify.register(sessionRoutes, { prefix: '/api/sessions' });
fastify.register(competitionRoutes, { prefix: '/api/competitions' });
fastify.register(billingRoutes, { prefix: '/api/billing' });
fastify.register(notificationRoutes, { prefix: '/api/notifications' });
fastify.register(connectionRoutes, { prefix: '/api/connections' });
fastify.register(contactRoutes, { prefix: '/api/contact' });
fastify.register(uploadRoutes, { prefix: '/api/uploads' });

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  // Prisma errors
  if (error.code === 'P2002') {
    return reply.code(409).send({
      error: 'Conflict',
      message: 'A record with this value already exists'
    });
  }
  
  if (error.code === 'P2025') {
    return reply.code(404).send({
      error: 'Not Found',
      message: 'Record not found'
    });
  }

  // Validation errors
  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation
    });
  }

  // Default error
  reply.code(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'Something went wrong'
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  fastify.log.info('Shutting down gracefully...');
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`🚀 Server running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;
