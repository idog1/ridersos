import { z } from 'zod';

const createConnectionSchema = z.object({
  to_user_email: z.string().email(),
  connection_type: z.string().default('Trainer-Rider')
});

const createGuardianSchema = z.object({
  minor_email: z.string().email()
});

export default async function connectionRoutes(fastify, options) {
  const { prisma } = fastify;

  // ============================================
  // USER CONNECTIONS
  // ============================================

  // List connections
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { from_user_email, to_user_email, status, connection_type } = request.query;
    
    const where = {};
    if (from_user_email) where.fromUserEmail = from_user_email;
    if (to_user_email) where.toUserEmail = to_user_email;
    if (status) where.status = status.toUpperCase();
    if (connection_type) where.connectionType = connection_type;
    
    const connections = await prisma.userConnection.findMany({
      where,
      include: {
        fromUser: {
          select: { email: true, firstName: true, lastName: true, fullName: true }
        },
        toUser: {
          select: { email: true, firstName: true, lastName: true, fullName: true }
        }
      }
    });
    
    return connections.map(mapConnectionToFrontend);
  });

  // Create connection request
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createConnectionSchema.parse(request.body);
    
    // Check if connection already exists
    const existing = await prisma.userConnection.findUnique({
      where: {
        fromUserEmail_toUserEmail_connectionType: {
          fromUserEmail: request.user.email,
          toUserEmail: data.to_user_email,
          connectionType: data.connection_type
        }
      }
    });
    
    if (existing) {
      return reply.code(409).send({ error: 'Connection already exists' });
    }
    
    const connection = await prisma.userConnection.create({
      data: {
        fromUserEmail: request.user.email,
        toUserEmail: data.to_user_email,
        connectionType: data.connection_type,
        status: 'PENDING'
      }
    });
    
    // Create notification for recipient
    await prisma.notification.create({
      data: {
        userEmail: data.to_user_email,
        type: 'CONNECTION_REQUEST',
        title: 'New Connection Request',
        message: `You have a new ${data.connection_type} connection request.`,
        relatedEntityType: 'UserConnection',
        relatedEntityId: connection.id
      }
    });

    // Send email notification
    try {
      const fromUser = await prisma.user.findUnique({ where: { email: request.user.email } });
      const fromName = fromUser?.firstName && fromUser?.lastName
        ? `${fromUser.firstName} ${fromUser.lastName}`
        : fromUser?.fullName || fromUser?.firstName || 'A user';

      const emailContent = fastify.emailTemplates.connectionRequest(
        fromName,
        'there', // Generic greeting since we might not know their name
        `${fromName} wants to connect with you as ${data.connection_type}.`
      );
      await fastify.sendEmail({
        to: data.to_user_email,
        ...emailContent
      });
    } catch (emailError) {
      fastify.log.error('Failed to send connection request email:', emailError);
    }

    return mapConnectionToFrontend(connection);
  });

  // Update connection status (approve/reject)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { status } = request.body;
    
    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return reply.code(400).send({ error: 'Invalid status' });
    }
    
    const existing = await prisma.userConnection.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Connection not found' });
    }
    
    // Only recipient can approve/reject
    if (existing.toUserEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const connection = await prisma.userConnection.update({
      where: { id: request.params.id },
      data: { status: status.toUpperCase() }
    });

    // Send email notification about the decision
    try {
      const fromUser = await prisma.user.findUnique({ where: { email: existing.fromUserEmail } });
      const toUser = await prisma.user.findUnique({ where: { email: request.user.email } });
      const toName = toUser?.firstName && toUser?.lastName
        ? `${toUser.firstName} ${toUser.lastName}`
        : toUser?.fullName || toUser?.firstName || 'A user';

      if (status === 'approved') {
        const emailContent = {
          subject: `${toName} accepted your connection request on RidersOS`,
          text: `Good news! ${toName} has accepted your connection request on RidersOS.\n\nYou can now work together on the platform.\n\nBest regards,\nThe RidersOS Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1B4332; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">RidersOS</h1>
              </div>
              <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #1B4332;">Connection Accepted!</h2>
                <p>Good news! <strong>${toName}</strong> has accepted your connection request on RidersOS.</p>
                <p>You can now work together on the platform.</p>
                <a href="${process.env.FRONTEND_URL}/Dashboard" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Go to Dashboard</a>
              </div>
              <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
                <p>Best regards,<br>The RidersOS Team</p>
              </div>
            </div>
          `
        };
        await fastify.sendEmail({ to: existing.fromUserEmail, ...emailContent });
      } else if (status === 'rejected') {
        const emailContent = {
          subject: `Connection request update on RidersOS`,
          text: `Your connection request on RidersOS was not accepted at this time.\n\nBest regards,\nThe RidersOS Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1B4332; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">RidersOS</h1>
              </div>
              <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #1B4332;">Connection Request Update</h2>
                <p>Your connection request on RidersOS was not accepted at this time.</p>
                <p>You can send new connection requests from your dashboard.</p>
                <a href="${process.env.FRONTEND_URL}/Dashboard" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Go to Dashboard</a>
              </div>
              <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
                <p>Best regards,<br>The RidersOS Team</p>
              </div>
            </div>
          `
        };
        await fastify.sendEmail({ to: existing.fromUserEmail, ...emailContent });
      }
    } catch (emailError) {
      fastify.log.error('Failed to send connection status email:', emailError);
    }

    return mapConnectionToFrontend(connection);
  });

  // Delete connection
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const existing = await prisma.userConnection.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Connection not found' });
    }
    
    // Either party can delete
    if (existing.fromUserEmail !== request.user.email && 
        existing.toUserEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    await prisma.userConnection.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });

  // ============================================
  // GUARDIAN-MINOR RELATIONSHIPS
  // ============================================

  // List guardian relationships
  fastify.get('/guardians', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { guardian_email, minor_email, status } = request.query;
    
    const where = {};
    if (guardian_email) where.guardianEmail = guardian_email.toLowerCase();
    if (minor_email) where.minorEmail = minor_email.toLowerCase();
    if (status) where.status = status.toUpperCase();
    
    const relationships = await prisma.guardianMinor.findMany({
      where,
      include: {
        guardian: {
          select: { email: true, firstName: true, lastName: true, fullName: true }
        },
        minor: {
          select: { email: true, firstName: true, lastName: true, fullName: true, birthday: true }
        }
      }
    });
    
    return relationships.map(mapGuardianToFrontend);
  });

  // Create guardian relationship
  fastify.post('/guardians', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createGuardianSchema.parse(request.body);
    
    // Verify the minor exists and has this user as parent
    const minor = await prisma.user.findUnique({
      where: { email: data.minor_email.toLowerCase() }
    });
    
    if (!minor) {
      return reply.code(404).send({ error: 'Minor user not found' });
    }
    
    // Either minor set parent_email or guardian is creating relationship
    const isAuthorized = 
      minor.parentEmail?.toLowerCase() === request.user.email.toLowerCase() ||
      request.user.email.toLowerCase() === data.minor_email.toLowerCase();
    
    if (!isAuthorized) {
      return reply.code(403).send({ error: 'Not authorized to create this relationship' });
    }
    
    // Check if relationship already exists
    const existing = await prisma.guardianMinor.findUnique({
      where: {
        guardianEmail_minorEmail: {
          guardianEmail: request.user.email.toLowerCase(),
          minorEmail: data.minor_email.toLowerCase()
        }
      }
    });
    
    if (existing) {
      return reply.code(409).send({ error: 'Relationship already exists' });
    }
    
    const relationship = await prisma.guardianMinor.create({
      data: {
        guardianEmail: request.user.email.toLowerCase(),
        minorEmail: data.minor_email.toLowerCase(),
        status: 'ACTIVE'
      }
    });
    
    // Update guardian's roles
    const guardian = await prisma.user.findUnique({
      where: { email: request.user.email }
    });

    if (!guardian.roles.includes('Parent/Guardian')) {
      await prisma.user.update({
        where: { email: request.user.email },
        data: {
          roles: [...guardian.roles, 'Parent/Guardian']
        }
      });
    }

    // Send email notification to minor
    try {
      const guardianName = guardian?.firstName && guardian?.lastName
        ? `${guardian.firstName} ${guardian.lastName}`
        : guardian?.fullName || guardian?.firstName || 'Your guardian';
      const minorName = minor?.firstName || minor?.fullName || 'there';

      const emailContent = fastify.emailTemplates.guardianInvite(
        guardianName,
        minorName,
        data.minor_email
      );
      await fastify.sendEmail({
        to: data.minor_email,
        ...emailContent
      });
    } catch (emailError) {
      fastify.log.error('Failed to send guardian invite email:', emailError);
    }

    return mapGuardianToFrontend(relationship);
  });

  // Update guardian relationship
  fastify.patch('/guardians/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { status } = request.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return reply.code(400).send({ error: 'Invalid status' });
    }
    
    const existing = await prisma.guardianMinor.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Relationship not found' });
    }
    
    if (existing.guardianEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    const relationship = await prisma.guardianMinor.update({
      where: { id: request.params.id },
      data: { status: status.toUpperCase() }
    });
    
    return mapGuardianToFrontend(relationship);
  });

  // Delete guardian relationship
  fastify.delete('/guardians/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const existing = await prisma.guardianMinor.findUnique({
      where: { id: request.params.id }
    });
    
    if (!existing) {
      return reply.code(404).send({ error: 'Relationship not found' });
    }
    
    if (existing.guardianEmail !== request.user.email) {
      return reply.code(403).send({ error: 'Not authorized' });
    }
    
    await prisma.guardianMinor.delete({
      where: { id: request.params.id }
    });
    
    return { success: true };
  });
}

function mapConnectionToFrontend(connection) {
  return {
    id: connection.id,
    from_user_email: connection.fromUserEmail,
    to_user_email: connection.toUserEmail,
    connection_type: connection.connectionType,
    status: connection.status?.toLowerCase(),
    created_date: connection.createdAt,
    updated_date: connection.updatedAt,
    from_user: connection.fromUser ? {
      email: connection.fromUser.email,
      first_name: connection.fromUser.firstName,
      last_name: connection.fromUser.lastName,
      full_name: connection.fromUser.fullName
    } : undefined,
    to_user: connection.toUser ? {
      email: connection.toUser.email,
      first_name: connection.toUser.firstName,
      last_name: connection.toUser.lastName,
      full_name: connection.toUser.fullName
    } : undefined
  };
}

function mapGuardianToFrontend(relationship) {
  return {
    id: relationship.id,
    guardian_email: relationship.guardianEmail,
    minor_email: relationship.minorEmail,
    status: relationship.status?.toLowerCase(),
    created_date: relationship.createdAt,
    guardian: relationship.guardian ? {
      email: relationship.guardian.email,
      first_name: relationship.guardian.firstName,
      last_name: relationship.guardian.lastName,
      full_name: relationship.guardian.fullName
    } : undefined,
    minor: relationship.minor ? {
      email: relationship.minor.email,
      first_name: relationship.minor.firstName,
      last_name: relationship.minor.lastName,
      full_name: relationship.minor.fullName,
      birthday: relationship.minor.birthday
    } : undefined
  };
}
