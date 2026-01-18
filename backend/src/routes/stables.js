import { z } from 'zod';

const createStableSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional()
});

const createEventSchema = z.object({
  title: z.string().min(1),
  event_type: z.enum(['Competition', 'Training', 'Clinic', 'Show', 'Other']),
  description: z.string().optional(),
  event_date: z.string(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

const eventTypeMap = {
  'Competition': 'COMPETITION',
  'Training': 'TRAINING',
  'Clinic': 'CLINIC',
  'Show': 'SHOW',
  'Other': 'OTHER'
};

const reverseEventTypeMap = Object.fromEntries(
  Object.entries(eventTypeMap).map(([k, v]) => [v, k])
);

export default async function stableRoutes(fastify, options) {
  const { prisma } = fastify;

  // List stables (public or filtered)
  fastify.get('/', {
    preHandler: [fastify.optionalAuth]
  }, async (request, reply) => {
    const { approval_status, manager_email } = request.query;
    
    const where = {};
    if (approval_status) {
      where.approvalStatus = approval_status.toUpperCase();
    }
    if (manager_email) {
      where.managerEmail = manager_email;
    }
    
    const stables = await prisma.stable.findMany({
      where,
      include: { events: true }
    });
    
    return stables.map(mapStableToFrontend);
  });

  // Get stable by ID
  fastify.get('/:id', async (request, reply) => {
    const stable = await prisma.stable.findUnique({
      where: { id: request.params.id },
      include: { events: true, manager: true }
    });
    
    if (!stable) {
      return reply.code(404).send({ error: 'Stable not found' });
    }
    
    return mapStableToFrontend(stable);
  });

  // Create stable
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createStableSchema.parse(request.body);
    
    const stable = await prisma.stable.create({
      data: {
        name: data.name,
        managerEmail: request.user.email,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        phone: data.phone,
        email: data.email,
        description: data.description,
        images: data.images || [],
        approvalStatus: 'PENDING'
      }
    });
    
    // Add StableManager role to user if not present
    const user = await prisma.user.findUnique({
      where: { email: request.user.email }
    });
    
    if (!user.roles.includes('StableManager')) {
      await prisma.user.update({
        where: { email: request.user.email },
        data: {
          roles: [...user.roles, 'StableManager']
        }
      });
    }
    
    return mapStableToFrontend(stable);
  });

  // Update stable
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createStableSchema.partial().parse(request.body);
    
    const existing = await prisma.stable.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Stable not found' });
    }
    
    // Check authorization (manager or admin)
    const user = await prisma.user.findUnique({
      where: { email: request.user.email }
    });
    
    if (existing.managerEmail !== request.user.email && !user.roles.includes('admin')) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    // Admin can update approval_status
    const updateData = { ...data };
    if (request.body.approval_status && user.roles.includes('admin')) {
      updateData.approvalStatus = request.body.approval_status.toUpperCase();
    }
    
    // Admin can change manager
    if (request.body.manager_email && user.roles.includes('admin')) {
      updateData.managerEmail = request.body.manager_email;
    }

    // Handle trainer_emails update
    if (request.body.trainer_emails !== undefined) {
      updateData.trainerEmails = request.body.trainer_emails;
    }

    const stable = await prisma.stable.update({
      where: { id: request.params.id },
      data: {
        name: updateData.name,
        address: updateData.address,
        city: updateData.city,
        state: updateData.state,
        country: updateData.country,
        latitude: updateData.latitude,
        longitude: updateData.longitude,
        phone: updateData.phone,
        email: updateData.email,
        description: updateData.description,
        images: updateData.images,
        trainerEmails: updateData.trainerEmails,
        approvalStatus: updateData.approvalStatus,
        managerEmail: updateData.managerEmail
      }
    });
    
    return mapStableToFrontend(stable);
  });

  // Delete stable (admin only)
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { email: request.user.email }
    });
    
    if (!user.roles.includes('admin')) {
      return reply.code(403).send({ error: 'Admin access required' });
    }
    
    await prisma.stable.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });

  // ============================================
  // STABLE EVENTS
  // ============================================

  // List events for a stable
  fastify.get('/:stableId/events', async (request, reply) => {
    const events = await prisma.stableEvent.findMany({
      where: { stableId: request.params.stableId },
      orderBy: { eventDate: 'asc' }
    });
    
    return events.map(mapEventToFrontend);
  });

  // Create stable event
  fastify.post('/:stableId/events', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createEventSchema.parse(request.body);
    
    // Verify stable ownership
    const stable = await prisma.stable.findUnique({
      where: { id: request.params.stableId }
    });
    
    if (!stable || stable.managerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const event = await prisma.stableEvent.create({
      data: {
        stableId: request.params.stableId,
        title: data.title,
        eventType: eventTypeMap[data.event_type],
        description: data.description,
        eventDate: new Date(data.event_date),
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude
      }
    });
    
    return mapEventToFrontend(event);
  });

  // Update stable event
  fastify.patch('/events/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createEventSchema.partial().parse(request.body);
    
    const event = await prisma.stableEvent.findUnique({
      where: { id: request.params.id },
      include: { stable: true }
    });
    
    if (!event || event.stable.managerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const updated = await prisma.stableEvent.update({
      where: { id: request.params.id },
      data: {
        title: data.title,
        eventType: data.event_type ? eventTypeMap[data.event_type] : undefined,
        description: data.description,
        eventDate: data.event_date ? new Date(data.event_date) : undefined,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude
      }
    });
    
    return mapEventToFrontend(updated);
  });

  // Delete stable event
  fastify.delete('/events/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const event = await prisma.stableEvent.findUnique({
      where: { id: request.params.id },
      include: { stable: true }
    });
    
    if (!event || event.stable.managerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    await prisma.stableEvent.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });
}

function mapStableToFrontend(stable) {
  return {
    id: stable.id,
    name: stable.name,
    manager_email: stable.managerEmail,
    address: stable.address,
    city: stable.city,
    state: stable.state,
    country: stable.country,
    latitude: stable.latitude ? parseFloat(stable.latitude) : null,
    longitude: stable.longitude ? parseFloat(stable.longitude) : null,
    phone: stable.phone,
    email: stable.email,
    description: stable.description,
    images: stable.images,
    trainer_emails: stable.trainerEmails || [],
    approval_status: stable.approvalStatus?.toLowerCase(),
    created_date: stable.createdAt,
    updated_date: stable.updatedAt,
    events: stable.events?.map(mapEventToFrontend),
    manager: stable.manager ? {
      email: stable.manager.email,
      first_name: stable.manager.firstName,
      last_name: stable.manager.lastName
    } : undefined
  };
}

function mapEventToFrontend(event) {
  return {
    id: event.id,
    stable_id: event.stableId,
    title: event.title,
    event_type: reverseEventTypeMap[event.eventType],
    description: event.description,
    event_date: event.eventDate,
    location: event.location,
    latitude: event.latitude ? parseFloat(event.latitude) : null,
    longitude: event.longitude ? parseFloat(event.longitude) : null,
    created_date: event.createdAt
  };
}
