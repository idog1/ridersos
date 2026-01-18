import { z } from 'zod';

const createSessionSchema = z.object({
  rider_email: z.string().email(),
  rider_name: z.string().optional(),
  horse_name: z.string().optional(),
  session_date: z.string(),
  duration: z.number().int().default(60),
  session_type: z.enum(['Lesson', 'Training', 'Horse Training', 'Horse Transport', 'Competition Prep', 'Evaluation', 'Other']),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_weeks: z.number().int().optional()
});

const sessionTypeMap = {
  'Lesson': 'LESSON',
  'Training': 'TRAINING',
  'Horse Training': 'HORSE_TRAINING',
  'Horse Transport': 'HORSE_TRANSPORT',
  'Competition Prep': 'COMPETITION_PREP',
  'Evaluation': 'EVALUATION',
  'Other': 'OTHER'
};

const reverseSessionTypeMap = Object.fromEntries(
  Object.entries(sessionTypeMap).map(([k, v]) => [v, k])
);

export default async function sessionRoutes(fastify, options) {
  const { prisma } = fastify;

  // List all sessions or filter
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { trainer_email, rider_email } = request.query;
    
    const where = {};
    if (trainer_email) where.trainerEmail = trainer_email;
    if (rider_email) where.riderEmail = rider_email;
    
    const sessions = await prisma.trainingSession.findMany({
      where,
      orderBy: { sessionDate: 'desc' }
    });
    
    return sessions.map(mapSessionToFrontend);
  });

  // Get session by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const session = await prisma.trainingSession.findUnique({
      where: { id: request.params.id }
    });
    
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    
    return mapSessionToFrontend(session);
  });

  // Create session (trainer only)
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createSessionSchema.parse(request.body);
    
    const session = await prisma.trainingSession.create({
      data: {
        trainerEmail: request.user.email,
        riderEmail: data.rider_email,
        riderName: data.rider_name,
        horseName: data.horse_name,
        sessionDate: new Date(data.session_date),
        duration: data.duration,
        sessionType: sessionTypeMap[data.session_type],
        notes: data.notes,
        isRecurring: data.is_recurring,
        recurrenceWeeks: data.recurrence_weeks
      }
    });
    
    // Create notification for rider
    await prisma.notification.create({
      data: {
        userEmail: data.rider_email,
        type: 'SESSION_SCHEDULED',
        title: 'New Training Session Scheduled',
        message: `A new ${data.session_type} session has been scheduled for ${new Date(data.session_date).toLocaleString()}.`,
        relatedEntityType: 'TrainingSession',
        relatedEntityId: session.id,
        link: `/RiderProfile?highlight=${session.id}`
      }
    });

    // Send email notification
    try {
      const trainer = await prisma.user.findUnique({ where: { email: request.user.email } });
      const rider = await prisma.user.findUnique({ where: { email: data.rider_email } });
      const trainerName = trainer?.firstName || trainer?.fullName || 'Your trainer';
      const riderName = rider?.firstName || rider?.fullName || 'Rider';
      const sessionDate = new Date(data.session_date).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });

      const emailContent = fastify.emailTemplates.sessionScheduled(riderName, trainerName, sessionDate, data.session_type);
      await fastify.sendEmail({
        to: data.rider_email,
        ...emailContent
      });
    } catch (emailError) {
      fastify.log.error('Failed to send session email:', emailError);
    }

    return mapSessionToFrontend(session);
  });

  // Update session
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createSessionSchema.partial().parse(request.body);
    
    const existing = await prisma.trainingSession.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    
    // Only trainer or rider can update
    if (existing.trainerEmail !== request.user.email && 
        existing.riderEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const updateData = {};
    if (data.rider_email) updateData.riderEmail = data.rider_email;
    if (data.rider_name !== undefined) updateData.riderName = data.rider_name;
    if (data.horse_name !== undefined) updateData.horseName = data.horse_name;
    if (data.session_date) updateData.sessionDate = new Date(data.session_date);
    if (data.duration) updateData.duration = data.duration;
    if (data.session_type) updateData.sessionType = sessionTypeMap[data.session_type];
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.is_recurring !== undefined) updateData.isRecurring = data.is_recurring;
    if (data.recurrence_weeks !== undefined) updateData.recurrenceWeeks = data.recurrence_weeks;
    
    // Handle verification from request body
    if (request.body.rider_verified !== undefined) {
      updateData.riderVerified = request.body.rider_verified;
      if (request.body.rider_verified) {
        updateData.riderVerifiedDate = new Date();
        updateData.status = 'COMPLETED';
      }
    }
    
    if (request.body.status) {
      updateData.status = request.body.status.toUpperCase();
    }
    
    const session = await prisma.trainingSession.update({
      where: { id: request.params.id },
      data: updateData
    });
    
    // Create notification about update and send email
    if (existing.trainerEmail === request.user.email) {
      await prisma.notification.create({
        data: {
          userEmail: existing.riderEmail,
          type: 'SESSION_SCHEDULED',
          title: 'Training Session Updated',
          message: `Your training session has been updated.`,
          relatedEntityType: 'TrainingSession',
          relatedEntityId: session.id,
          link: `/RiderProfile?highlight=${session.id}`
        }
      });

      // Send email notification
      try {
        const trainer = await prisma.user.findUnique({ where: { email: request.user.email } });
        const rider = await prisma.user.findUnique({ where: { email: existing.riderEmail } });
        const trainerName = trainer?.firstName || trainer?.fullName || 'Your trainer';
        const riderName = rider?.firstName || rider?.fullName || 'Rider';
        const sessionDate = new Date(session.sessionDate).toLocaleString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });

        const emailContent = fastify.emailTemplates.sessionUpdated(riderName, trainerName, sessionDate, 'Check the app for details.');
        await fastify.sendEmail({
          to: existing.riderEmail,
          ...emailContent
        });
      } catch (emailError) {
        fastify.log.error('Failed to send session update email:', emailError);
      }
    }

    return mapSessionToFrontend(session);
  });

  // Delete session
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const existing = await prisma.trainingSession.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    
    if (existing.trainerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    // Create cancellation notification
    await prisma.notification.create({
      data: {
        userEmail: existing.riderEmail,
        type: 'SESSION_CANCELLED',
        title: 'Training Session Cancelled',
        message: `Your ${reverseSessionTypeMap[existing.sessionType]} session on ${existing.sessionDate.toLocaleString()} has been cancelled.`,
        relatedEntityType: 'TrainingSession',
        relatedEntityId: existing.id
      }
    });

    // Send cancellation email
    try {
      const trainer = await prisma.user.findUnique({ where: { email: request.user.email } });
      const rider = await prisma.user.findUnique({ where: { email: existing.riderEmail } });
      const trainerName = trainer?.firstName || trainer?.fullName || 'Your trainer';
      const riderName = rider?.firstName || rider?.fullName || 'Rider';
      const sessionDate = new Date(existing.sessionDate).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });

      const emailContent = fastify.emailTemplates.sessionCancelled(riderName, trainerName, sessionDate);
      await fastify.sendEmail({
        to: existing.riderEmail,
        ...emailContent
      });
    } catch (emailError) {
      fastify.log.error('Failed to send cancellation email:', emailError);
    }

    await prisma.trainingSession.delete({
      where: { id: request.params.id }
    });

    return { success: true };
  });

  // Verify session (rider endpoint)
  fastify.post('/:id/verify', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const existing = await prisma.trainingSession.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    
    if (existing.riderEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Only rider can verify session' });
    }
    
    const session = await prisma.trainingSession.update({
      where: { id: request.params.id },
      data: {
        riderVerified: true,
        riderVerifiedDate: new Date(),
        status: 'COMPLETED'
      }
    });
    
    return mapSessionToFrontend(session);
  });
}

function mapSessionToFrontend(session) {
  return {
    id: session.id,
    trainer_email: session.trainerEmail,
    rider_email: session.riderEmail,
    rider_name: session.riderName,
    horse_name: session.horseName,
    session_date: session.sessionDate,
    duration: session.duration,
    session_type: reverseSessionTypeMap[session.sessionType],
    notes: session.notes,
    is_recurring: session.isRecurring,
    recurrence_weeks: session.recurrenceWeeks,
    rider_verified: session.riderVerified,
    rider_verified_date: session.riderVerifiedDate,
    status: session.status?.toLowerCase(),
    created_date: session.createdAt,
    updated_date: session.updatedAt
  };
}
