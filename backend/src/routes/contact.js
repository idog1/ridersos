import { z } from 'zod';

const createMessageSchema = z.object({
  type: z.enum(['general', 'bug_report', 'feature_suggestion']),
  subject: z.string().min(1),
  message: z.string().min(1),
  sender_name: z.string().optional(),
  sender_email: z.string().email().optional()
});

const messageTypeMap = {
  'general': 'GENERAL',
  'bug_report': 'BUG_REPORT',
  'feature_suggestion': 'FEATURE_SUGGESTION'
};

const reverseMessageTypeMap = Object.fromEntries(
  Object.entries(messageTypeMap).map(([k, v]) => [v, k])
);

export default async function contactRoutes(fastify, options) {
  const { prisma } = fastify;

  // List messages (admin only)
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { email: request.user.email }
    });
    
    if (!user.roles.includes('admin')) {
      return reply.code(403).send({ error: 'Admin access required' });
    }
    
    const { status, type } = request.query;
    
    const where = {};
    if (status) where.status = status.toUpperCase();
    if (type) where.type = messageTypeMap[type];
    
    const messages = await prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    return messages.map(mapMessageToFrontend);
  });

  // Get message by ID (admin only)
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { email: request.user.email }
    });
    
    if (!user.roles.includes('admin')) {
      return reply.code(403).send({ error: 'Admin access required' });
    }
    
    const message = await prisma.contactMessage.findUnique({
      where: { id: request.params.id }
    });
    
    if (!message) {
      return reply.code(404).send({ error: 'Message not found' });
    }
    
    return mapMessageToFrontend(message);
  });

  // Create message (public or authenticated)
  fastify.post('/', {
    preHandler: [fastify.optionalAuth]
  }, async (request, reply) => {
    const data = createMessageSchema.parse(request.body);
    
    const message = await prisma.contactMessage.create({
      data: {
        senderEmail: request.user?.email || data.sender_email,
        senderName: data.sender_name,
        type: messageTypeMap[data.type],
        subject: data.subject,
        message: data.message,
        status: 'NEW'
      }
    });
    
    return mapMessageToFrontend(message);
  });

  // Update message status (admin only)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { email: request.user.email }
    });
    
    if (!user.roles.includes('admin')) {
      return reply.code(403).send({ error: 'Admin access required' });
    }
    
    const { status } = request.body;
    
    if (!status || !['new', 'read', 'resolved'].includes(status)) {
      return reply.code(400).send({ error: 'Invalid status' });
    }
    
    const message = await prisma.contactMessage.update({
      where: { id: request.params.id },
      data: { status: status.toUpperCase() }
    });
    
    return mapMessageToFrontend(message);
  });

  // Delete message (admin only)
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { email: request.user.email }
    });
    
    if (!user.roles.includes('admin')) {
      return reply.code(403).send({ error: 'Admin access required' });
    }
    
    await prisma.contactMessage.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });
}

function mapMessageToFrontend(message) {
  return {
    id: message.id,
    sender_email: message.senderEmail,
    sender_name: message.senderName,
    type: reverseMessageTypeMap[message.type],
    subject: message.subject,
    message: message.message,
    status: message.status?.toLowerCase(),
    created_date: message.createdAt
  };
}
