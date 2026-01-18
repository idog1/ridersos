import { z } from 'zod';

const createRateSchema = z.object({
  session_type: z.string(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ILS']).default('ILS'),
  rate: z.number()
});

const createSummarySchema = z.object({
  rider_email: z.string().email(),
  month: z.string(),
  sessions_revenue: z.number(),
  competitions_revenue: z.number(),
  total_revenue: z.number(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ILS']).default('ILS'),
  session_count: z.number().int(),
  payment_requested: z.boolean().default(false),
  payment_status: z.enum(['pending', 'requested', 'paid']).default('pending')
});

export default async function billingRoutes(fastify, options) {
  const { prisma } = fastify;

  // ============================================
  // BILLING RATES
  // ============================================

  // List rates for trainer
  fastify.get('/rates', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { trainer_email } = request.query;
    
    const where = trainer_email 
      ? { trainerEmail: trainer_email }
      : { trainerEmail: request.user.email };
    
    const rates = await prisma.billingRate.findMany({ where });
    
    return rates.map(mapRateToFrontend);
  });

  // Create or update rate
  fastify.post('/rates', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createRateSchema.parse(request.body);
    
    const rate = await prisma.billingRate.upsert({
      where: {
        trainerEmail_sessionType: {
          trainerEmail: request.user.email,
          sessionType: data.session_type
        }
      },
      update: {
        currency: data.currency,
        rate: data.rate
      },
      create: {
        trainerEmail: request.user.email,
        sessionType: data.session_type,
        currency: data.currency,
        rate: data.rate
      }
    });
    
    return mapRateToFrontend(rate);
  });

  // Bulk update rates
  fastify.put('/rates', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const rates = z.array(createRateSchema).parse(request.body);
    
    const results = [];
    
    for (const data of rates) {
      const rate = await prisma.billingRate.upsert({
        where: {
          trainerEmail_sessionType: {
            trainerEmail: request.user.email,
            sessionType: data.session_type
          }
        },
        update: {
          currency: data.currency,
          rate: data.rate
        },
        create: {
          trainerEmail: request.user.email,
          sessionType: data.session_type,
          currency: data.currency,
          rate: data.rate
        }
      });
      results.push(mapRateToFrontend(rate));
    }
    
    return results;
  });

  // Delete rate
  fastify.delete('/rates/:sessionType', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    await prisma.billingRate.delete({
      where: {
        trainerEmail_sessionType: {
          trainerEmail: request.user.email,
          sessionType: request.params.sessionType
        }
      }
    });
    
    return { success: true };
  });

  // ============================================
  // MONTHLY SUMMARIES
  // ============================================

  // List summaries
  fastify.get('/summaries', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { trainer_email, rider_email, month } = request.query;
    
    const where = {};
    if (trainer_email) where.trainerEmail = trainer_email;
    if (rider_email) where.riderEmail = rider_email;
    if (month) where.month = month;
    
    const summaries = await prisma.monthlyBillingSummary.findMany({
      where,
      orderBy: { month: 'desc' }
    });
    
    return summaries.map(mapSummaryToFrontend);
  });

  // Create summary
  fastify.post('/summaries', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createSummarySchema.parse(request.body);
    
    const summary = await prisma.monthlyBillingSummary.create({
      data: {
        trainerEmail: request.user.email,
        riderEmail: data.rider_email,
        month: data.month,
        sessionsRevenue: data.sessions_revenue,
        competitionsRevenue: data.competitions_revenue,
        totalRevenue: data.total_revenue,
        currency: data.currency,
        sessionCount: data.session_count,
        paymentRequested: data.payment_requested,
        paymentStatus: data.payment_status.toUpperCase()
      }
    });
    
    // Create notification for rider
    if (data.payment_requested) {
      // Check if rider is a minor
      const rider = await prisma.user.findUnique({
        where: { email: data.rider_email }
      });
      
      let notifyEmail = data.rider_email;
      if (rider?.birthday) {
        const age = Math.floor((Date.now() - new Date(rider.birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18 && rider.parentEmail) {
          notifyEmail = rider.parentEmail;
        }
      }
      
      await prisma.notification.create({
        data: {
          userEmail: notifyEmail,
          type: 'PAYMENT_REQUEST',
          title: 'Payment Request',
          message: `Payment request for ${data.month}: ${data.currency} ${data.total_revenue.toFixed(2)}`,
          relatedEntityType: 'MonthlyBillingSummary',
          relatedEntityId: summary.id,
          link: '/RiderProfile'
        }
      });

      // Send email notification
      try {
        const trainer = await prisma.user.findUnique({ where: { email: request.user.email } });
        const trainerName = trainer?.firstName && trainer?.lastName
          ? `${trainer.firstName} ${trainer.lastName}`
          : trainer?.fullName || trainer?.firstName || 'Your trainer';
        const riderName = rider?.firstName || rider?.fullName || 'Rider';

        const emailContent = fastify.emailTemplates.paymentRequest(
          riderName,
          trainerName,
          data.total_revenue.toFixed(2),
          data.currency,
          data.month
        );
        await fastify.sendEmail({
          to: notifyEmail,
          ...emailContent
        });
      } catch (emailError) {
        fastify.log.error('Failed to send payment request email:', emailError);
      }
    }

    return mapSummaryToFrontend(summary);
  });

  // Update summary
  fastify.patch('/summaries/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createSummarySchema.partial().parse(request.body);
    
    const existing = await prisma.monthlyBillingSummary.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Summary not found' });
    }
    
    // Only trainer can update
    if (existing.trainerEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const updateData = {};
    if (data.sessions_revenue !== undefined) updateData.sessionsRevenue = data.sessions_revenue;
    if (data.competitions_revenue !== undefined) updateData.competitionsRevenue = data.competitions_revenue;
    if (data.total_revenue !== undefined) updateData.totalRevenue = data.total_revenue;
    if (data.session_count !== undefined) updateData.sessionCount = data.session_count;
    if (data.payment_requested !== undefined) updateData.paymentRequested = data.payment_requested;
    if (data.payment_status !== undefined) updateData.paymentStatus = data.payment_status.toUpperCase();
    
    const summary = await prisma.monthlyBillingSummary.update({
      where: { id: request.params.id },
      data: updateData
    });
    
    return mapSummaryToFrontend(summary);
  });
}

function mapRateToFrontend(rate) {
  return {
    id: rate.id,
    trainer_email: rate.trainerEmail,
    session_type: rate.sessionType,
    currency: rate.currency,
    rate: parseFloat(rate.rate),
    created_date: rate.createdAt,
    updated_date: rate.updatedAt
  };
}

function mapSummaryToFrontend(summary) {
  return {
    id: summary.id,
    trainer_email: summary.trainerEmail,
    rider_email: summary.riderEmail,
    month: summary.month,
    sessions_revenue: parseFloat(summary.sessionsRevenue),
    competitions_revenue: parseFloat(summary.competitionsRevenue),
    total_revenue: parseFloat(summary.totalRevenue),
    currency: summary.currency,
    session_count: summary.sessionCount,
    payment_requested: summary.paymentRequested,
    payment_status: summary.paymentStatus?.toLowerCase(),
    created_date: summary.createdAt
  };
}
