import { z } from 'zod';

export default async function userRoutes(fastify, options) {
  const { prisma } = fastify;

  // List all users (replaces base44.entities.User.list())
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        roles: true,
        profileImage: true,
        birthday: true,
        parentEmail: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    return users.map(mapUserToFrontend);
  });

  // Get user by email
  fastify.get('/by-email/:email', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { email: request.params.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        roles: true,
        profileImage: true,
        birthday: true,
        parentEmail: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    
    return mapUserToFrontend(user);
  });

  // Get user by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        roles: true,
        profileImage: true,
        birthday: true,
        parentEmail: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return mapUserToFrontend(user);
  });

  // Update user (admin only)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Check if current user is admin
    if (!request.user.roles?.includes('admin')) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { roles, first_name, last_name, full_name } = request.body;

    const updateData = {};
    if (roles !== undefined) updateData.roles = roles;
    if (first_name !== undefined) updateData.firstName = first_name;
    if (last_name !== undefined) updateData.lastName = last_name;
    if (full_name !== undefined) updateData.fullName = full_name;

    const user = await prisma.user.update({
      where: { id: request.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        roles: true,
        profileImage: true,
        birthday: true,
        parentEmail: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return mapUserToFrontend(user);
  });

  // Delete user (admin only)
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Check if current user is admin
    if (!request.user.roles?.includes('admin')) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    // Prevent deleting yourself
    if (request.params.id === request.user.id) {
      return reply.code(400).send({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id: request.params.id }
    });

    return { success: true };
  });
}

function mapUserToFrontend(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    full_name: user.fullName,
    roles: user.roles,
    profile_image: user.profileImage,
    birthday: user.birthday,
    parent_email: user.parentEmail,
    created_date: user.createdAt,
    updated_date: user.updatedAt
  };
}
