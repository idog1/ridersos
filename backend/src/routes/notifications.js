import { z } from 'zod';

const createNotificationSchema = z.object({
  user_email: z.string().email(),
  type: z.enum(['session_scheduled', 'session_cancelled', 'payment_request', 'connection_request', 'horse_care_reminder']),
  title: z.string(),
  message: z.string(),
  related_entity_type: z.string().optional(),
  related_entity_id: z.string().optional(),
  link: z.string().optional()
});

const updatePreferenceSchema = z.object({
  notification_type: z.string(),
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional()
});

const notificationTypeMap = {
  'session_scheduled': 'SESSION_SCHEDULED',
  'session_cancelled': 'SESSION_CANCELLED',
  'payment_request': 'PAYMENT_REQUEST',
  'connection_request': 'CONNECTION_REQUEST',
  'horse_care_reminder': 'HORSE_CARE_REMINDER'
};

const reverseNotificationTypeMap = Object.fromEntries(
  Object.entries(notificationTypeMap).map(([k, v]) => [v, k])
);

export default async function notificationRoutes(fastify, options) {
  const { prisma } = fastify;

  // ============================================
  // NOTIFICATIONS
  // ============================================

  // List notifications for current user
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { user_email, unread_only } = request.query;
    
    const where = {
      userEmail: user_email || request.user.email
    };
    
    if (unread_only === 'true') {
      where.read = false;
    }
    
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    return notifications.map(mapNotificationToFrontend);
  });

  // Get unread count
  fastify.get('/unread-count', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const count = await prisma.notification.count({
      where: {
        userEmail: request.user.email,
        read: false
      }
    });
    
    return { count };
  });

  // Create notification
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createNotificationSchema.parse(request.body);

    const notification = await prisma.notification.create({
      data: {
        userEmail: data.user_email,
        type: notificationTypeMap[data.type],
        title: data.title,
        message: data.message,
        relatedEntityType: data.related_entity_type,
        relatedEntityId: data.related_entity_id,
        link: data.link
      }
    });

    return mapNotificationToFrontend(notification);
  });

  // Update notification (generic PATCH endpoint)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const notification = await prisma.notification.findUnique({
      where: { id: request.params.id }
    });

    if (!notification) {
      return reply.code(404).send({ error: 'Notification not found' });
    }

    if (notification.userEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    const updateData = {};
    if (request.body.read !== undefined) {
      updateData.read = request.body.read;
    }

    const updated = await prisma.notification.update({
      where: { id: request.params.id },
      data: updateData
    });

    return mapNotificationToFrontend(updated);
  });

  // Mark notification as read (legacy endpoint)
  fastify.patch('/:id/read', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const notification = await prisma.notification.findUnique({
      where: { id: request.params.id }
    });

    if (!notification) {
      return reply.code(404).send({ error: 'Notification not found' });
    }

    if (notification.userEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    const updated = await prisma.notification.update({
      where: { id: request.params.id },
      data: { read: true }
    });

    return mapNotificationToFrontend(updated);
  });

  // Mark all notifications as read
  fastify.post('/mark-all-read', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    await prisma.notification.updateMany({
      where: {
        userEmail: request.user.email,
        read: false
      },
      data: { read: true }
    });
    
    return { success: true };
  });

  // Delete notification
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const notification = await prisma.notification.findUnique({
      where: { id: request.params.id }
    });
    
    if (!notification) {
      return reply.code(404).send({ error: 'Notification not found' });
    }
    
    if (notification.userEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    await prisma.notification.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });

  // ============================================
  // NOTIFICATION PREFERENCES
  // ============================================

  // Get preferences
  fastify.get('/preferences', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const preferences = await prisma.notificationPreference.findMany({
      where: { userEmail: request.user.email }
    });
    
    return preferences.map(p => ({
      id: p.id,
      notification_type: p.notificationType,
      email_enabled: p.emailEnabled,
      in_app_enabled: p.inAppEnabled,
      updated_date: p.updatedAt
    }));
  });

  // Update preference
  fastify.put('/preferences', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = updatePreferenceSchema.parse(request.body);
    
    const preference = await prisma.notificationPreference.upsert({
      where: {
        userEmail_notificationType: {
          userEmail: request.user.email,
          notificationType: data.notification_type
        }
      },
      update: {
        emailEnabled: data.email_enabled,
        inAppEnabled: data.in_app_enabled
      },
      create: {
        userEmail: request.user.email,
        notificationType: data.notification_type,
        emailEnabled: data.email_enabled ?? true,
        inAppEnabled: data.in_app_enabled ?? true
      }
    });
    
    return {
      id: preference.id,
      notification_type: preference.notificationType,
      email_enabled: preference.emailEnabled,
      in_app_enabled: preference.inAppEnabled,
      updated_date: preference.updatedAt
    };
  });

  // Bulk update preferences
  fastify.put('/preferences/bulk', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const preferences = z.array(updatePreferenceSchema).parse(request.body);
    
    const results = [];
    
    for (const data of preferences) {
      const preference = await prisma.notificationPreference.upsert({
        where: {
          userEmail_notificationType: {
            userEmail: request.user.email,
            notificationType: data.notification_type
          }
        },
        update: {
          emailEnabled: data.email_enabled,
          inAppEnabled: data.in_app_enabled
        },
        create: {
          userEmail: request.user.email,
          notificationType: data.notification_type,
          emailEnabled: data.email_enabled ?? true,
          inAppEnabled: data.in_app_enabled ?? true
        }
      });
      
      results.push({
        id: preference.id,
        notification_type: preference.notificationType,
        email_enabled: preference.emailEnabled,
        in_app_enabled: preference.inAppEnabled,
        updated_date: preference.updatedAt
      });
    }
    
    return results;
  });
}

function mapNotificationToFrontend(notification) {
  return {
    id: notification.id,
    user_email: notification.userEmail,
    type: reverseNotificationTypeMap[notification.type],
    title: notification.title,
    message: notification.message,
    related_entity_type: notification.relatedEntityType,
    related_entity_id: notification.relatedEntityId,
    link: notification.link,
    read: notification.read,
    created_date: notification.createdAt
  };
}
