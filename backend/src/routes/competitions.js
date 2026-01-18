import { z } from 'zod';

const riderSchema = z.object({
  rider_email: z.string().email(),
  rider_name: z.string().optional(),
  services: z.array(z.string()).default([]),
  payment_status: z.enum(['pending', 'requested', 'paid']).default('pending')
});

const createCompetitionSchema = z.object({
  name: z.string().min(1),
  competition_date: z.string(),
  location: z.string(),
  riders: z.array(riderSchema).default([])
});

export default async function competitionRoutes(fastify, options) {
  const { prisma } = fastify;

  // List competitions
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { trainer_email } = request.query;
    
    const where = trainer_email ? { trainerEmail: trainer_email } : {};
    
    const competitions = await prisma.competition.findMany({
      where,
      orderBy: { competitionDate: 'desc' }
    });
    
    return competitions.map(mapCompetitionToFrontend);
  });

  // Get competition by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const competition = await prisma.competition.findUnique({
      where: { id: request.params.id }
    });
    
    if (!competition) {
      return reply.code(404).send({ error: 'Competition not found' });
    }
    
    return mapCompetitionToFrontend(competition);
  });

  // Create competition
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createCompetitionSchema.parse(request.body);
    
    const competition = await prisma.competition.create({
      data: {
        trainerEmail: request.user.email,
        name: data.name,
        competitionDate: new Date(data.competition_date),
        location: data.location,
        riders: data.riders
      }
    });
    
    // Create notifications for riders
    for (const rider of data.riders) {
      await prisma.notification.create({
        data: {
          userEmail: rider.rider_email,
          type: 'SESSION_SCHEDULED',
          title: 'Competition Scheduled',
          message: `You have been added to competition "${data.name}" on ${new Date(data.competition_date).toLocaleDateString()}.`,
          relatedEntityType: 'Competition',
          relatedEntityId: competition.id
        }
      });
    }
    
    return mapCompetitionToFrontend(competition);
  });

  // Update competition
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createCompetitionSchema.partial().parse(request.body);
    
    const existing = await prisma.competition.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Competition not found' });
    }
    
    if (existing.trainerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const updateData = {};
    if (data.name) updateData.name = data.name;
    if (data.competition_date) updateData.competitionDate = new Date(data.competition_date);
    if (data.location) updateData.location = data.location;
    if (data.riders !== undefined) updateData.riders = data.riders;
    
    const competition = await prisma.competition.update({
      where: { id: request.params.id },
      data: updateData
    });
    
    return mapCompetitionToFrontend(competition);
  });

  // Delete competition
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const existing = await prisma.competition.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Competition not found' });
    }
    
    if (existing.trainerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    await prisma.competition.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });
}

function mapCompetitionToFrontend(competition) {
  return {
    id: competition.id,
    trainer_email: competition.trainerEmail,
    name: competition.name,
    competition_date: competition.competitionDate,
    location: competition.location,
    riders: competition.riders,
    created_date: competition.createdAt,
    updated_date: competition.updatedAt
  };
}
