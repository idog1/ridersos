import { z } from 'zod';

const createHorseSchema = z.object({
  name: z.string().min(1),
  home_stable_name: z.string().optional(),
  suite_number: z.string().optional(),
  breed: z.string().optional(),
  birth_year: z.number().int().optional(),
  color: z.string().optional(),
  height: z.string().optional(),
  chip_number: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().optional()
});

const createEventSchema = z.object({
  horse_id: z.string().uuid(),
  event_type: z.enum(['Farrier', 'Vaccination', 'Veterinarian', 'Other']),
  event_date: z.string(),
  provider_name: z.string().optional(),
  description: z.string().optional(),
  cost: z.number().optional(),
  next_due_date: z.string().optional(),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_weeks: z.number().int().optional(),
  reminder_weeks_before: z.number().int().optional(),
  reminder_email: z.string().email().optional()
});

export default async function horseRoutes(fastify, options) {
  const { prisma } = fastify;

  // List all horses (for admin) or filter
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { owner_email } = request.query;
    
    const where = owner_email ? { ownerEmail: owner_email } : {};
    
    const horses = await prisma.horse.findMany({
      where,
      include: { events: true }
    });
    
    return horses.map(mapHorseToFrontend);
  });

  // Get horse by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const horse = await prisma.horse.findUnique({
      where: { id: request.params.id },
      include: { events: true }
    });
    
    if (!horse) {
      return reply.code(404).send({ error: 'Horse not found' });
    }
    
    return mapHorseToFrontend(horse);
  });

  // Create horse
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createHorseSchema.parse(request.body);
    
    const horse = await prisma.horse.create({
      data: {
        ownerEmail: request.user.email,
        name: data.name,
        homeStableName: data.home_stable_name,
        suiteNumber: data.suite_number,
        breed: data.breed,
        birthYear: data.birth_year,
        color: data.color,
        height: data.height,
        chipNumber: data.chip_number,
        description: data.description,
        imageUrl: data.image_url
      }
    });
    
    return mapHorseToFrontend(horse);
  });

  // Update horse
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createHorseSchema.partial().parse(request.body);
    
    // Verify ownership
    const existing = await prisma.horse.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Horse not found' });
    }
    
    if (existing.ownerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const horse = await prisma.horse.update({
      where: { id: request.params.id },
      data: {
        name: data.name,
        homeStableName: data.home_stable_name,
        suiteNumber: data.suite_number,
        breed: data.breed,
        birthYear: data.birth_year,
        color: data.color,
        height: data.height,
        chipNumber: data.chip_number,
        description: data.description,
        imageUrl: data.image_url
      }
    });
    
    return mapHorseToFrontend(horse);
  });

  // Delete horse
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const existing = await prisma.horse.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Horse not found' });
    }
    
    if (existing.ownerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    await prisma.horse.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });

  // ============================================
  // HORSE EVENTS
  // ============================================

  // List events for a horse
  fastify.get('/:horseId/events', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const events = await prisma.horseEvent.findMany({
      where: { horseId: request.params.horseId },
      orderBy: { eventDate: 'desc' }
    });
    
    return events.map(mapEventToFrontend);
  });

  // Create event
  fastify.post('/events', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createEventSchema.parse(request.body);
    
    // Verify horse ownership
    const horse = await prisma.horse.findUnique({
      where: { id: data.horse_id }
    });
    
    if (!horse || horse.ownerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const eventTypeMap = {
      'Farrier': 'FARRIER',
      'Vaccination': 'VACCINATION',
      'Veterinarian': 'VETERINARIAN',
      'Other': 'OTHER'
    };
    
    const event = await prisma.horseEvent.create({
      data: {
        horseId: data.horse_id,
        eventType: eventTypeMap[data.event_type],
        eventDate: new Date(data.event_date),
        providerName: data.provider_name,
        description: data.description,
        cost: data.cost,
        nextDueDate: data.next_due_date ? new Date(data.next_due_date) : null,
        notes: data.notes,
        isRecurring: data.is_recurring,
        recurrenceWeeks: data.recurrence_weeks,
        reminderWeeksBefore: data.reminder_weeks_before,
        reminderEmail: data.reminder_email
      }
    });

    // Send email notification if next_due_date is set
    if (data.next_due_date) {
      try {
        const owner = await prisma.user.findUnique({ where: { email: horse.ownerEmail } });
        const ownerName = owner?.firstName || owner?.fullName || 'Horse Owner';
        const notifyEmail = data.reminder_email || horse.ownerEmail;

        const dueDate = new Date(data.next_due_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const emailContent = fastify.emailTemplates.horseCareReminder(
          ownerName,
          horse.name,
          data.event_type,
          dueDate
        );
        await fastify.sendEmail({ to: notifyEmail, ...emailContent });
      } catch (emailError) {
        fastify.log.error('Failed to send horse care reminder email:', emailError);
      }
    }

    return mapEventToFrontend(event);
  });

  // Update event
  fastify.patch('/events/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createEventSchema.partial().parse(request.body);
    
    const event = await prisma.horseEvent.findUnique({
      where: { id: request.params.id },
      include: { horse: true }
    });
    
    if (!event || event.horse.ownerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const eventTypeMap = {
      'Farrier': 'FARRIER',
      'Vaccination': 'VACCINATION',
      'Veterinarian': 'VETERINARIAN',
      'Other': 'OTHER'
    };
    
    const updated = await prisma.horseEvent.update({
      where: { id: request.params.id },
      data: {
        eventType: data.event_type ? eventTypeMap[data.event_type] : undefined,
        eventDate: data.event_date ? new Date(data.event_date) : undefined,
        providerName: data.provider_name,
        description: data.description,
        cost: data.cost,
        nextDueDate: data.next_due_date ? new Date(data.next_due_date) : undefined,
        notes: data.notes,
        status: data.status === 'completed' ? 'COMPLETED' : undefined,
        completedDate: data.status === 'completed' ? new Date() : undefined,
        isRecurring: data.is_recurring,
        recurrenceWeeks: data.recurrence_weeks,
        reminderWeeksBefore: data.reminder_weeks_before,
        reminderEmail: data.reminder_email
      }
    });
    
    return mapEventToFrontend(updated);
  });

  // Delete event
  fastify.delete('/events/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const event = await prisma.horseEvent.findUnique({
      where: { id: request.params.id },
      include: { horse: true }
    });
    
    if (!event || event.horse.ownerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    await prisma.horseEvent.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });
}

function mapHorseToFrontend(horse) {
  return {
    id: horse.id,
    owner_email: horse.ownerEmail,
    name: horse.name,
    home_stable_name: horse.homeStableName,
    suite_number: horse.suiteNumber,
    breed: horse.breed,
    birth_year: horse.birthYear,
    color: horse.color,
    height: horse.height,
    chip_number: horse.chipNumber,
    description: horse.description,
    image_url: horse.imageUrl,
    created_date: horse.createdAt,
    updated_date: horse.updatedAt,
    events: horse.events?.map(mapEventToFrontend)
  };
}

function mapEventToFrontend(event) {
  const eventTypeMap = {
    'FARRIER': 'Farrier',
    'VACCINATION': 'Vaccination',
    'VETERINARIAN': 'Veterinarian',
    'OTHER': 'Other'
  };
  
  return {
    id: event.id,
    horse_id: event.horseId,
    event_type: eventTypeMap[event.eventType],
    event_date: event.eventDate,
    provider_name: event.providerName,
    description: event.description,
    cost: event.cost ? parseFloat(event.cost) : null,
    next_due_date: event.nextDueDate,
    notes: event.notes,
    status: event.status?.toLowerCase(),
    completed_date: event.completedDate,
    is_recurring: event.isRecurring,
    recurrence_weeks: event.recurrenceWeeks,
    reminder_weeks_before: event.reminderWeeksBefore,
    reminder_email: event.reminderEmail,
    created_date: event.createdAt
  };
}
