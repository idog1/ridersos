import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sendEmail, emailTemplates } from '../services/email.js';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const updateMeSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  roles: z.array(z.string()).optional(),
  profileImage: z.string().optional(),
  birthday: z.string().optional(),
  parentEmail: z.string().email().optional().nullable(),
  dashboardCardOrder: z.array(z.string()).optional(),
  lockerNumber: z.string().optional()
});

export default async function authRoutes(fastify, options) {
  const { prisma } = fastify;

  // Register with email/password
  fastify.post('/register', async (request, reply) => {
    const data = registerSchema.parse(request.body);
    
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });
    
    if (existing) {
      return reply.code(409).send({ error: 'User already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: data.firstName && data.lastName
          ? `${data.firstName} ${data.lastName}`
          : null,
        roles: ['Rider'] // Default role
      }
    });

    // Send welcome email (non-blocking)
    const userName = user.firstName || user.email.split('@')[0];
    const welcomeEmail = emailTemplates.welcomeUser(userName);
    sendEmail({
      to: user.email,
      subject: welcomeEmail.subject,
      text: welcomeEmail.text,
      html: welcomeEmail.html
    }).catch(err => console.error('Failed to send welcome email:', err));

    // Generate token
    const token = fastify.jwt.sign({ 
      id: user.id, 
      email: user.email 
    });
    
    return {
      token,
      user: sanitizeUser(user)
    };
  });

  // Login with email/password
  fastify.post('/login', async (request, reply) => {
    const data = loginSchema.parse(request.body);
    
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });
    
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    
    if (!validPassword) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const token = fastify.jwt.sign({ 
      id: user.id, 
      email: user.email 
    });
    
    return {
      token,
      user: sanitizeUser(user)
    };
  });

  // Google OAuth callback handler
  fastify.post('/google', async (request, reply) => {
    const { googleToken, profile } = request.body;
    
    if (!profile || !profile.email) {
      return reply.code(400).send({ error: 'Invalid Google profile' });
    }
    
    let user = await prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() }
    });
    
    if (!user) {
      // Create new user from Google profile
      user = await prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          googleId: profile.id,
          firstName: profile.given_name,
          lastName: profile.family_name,
          fullName: profile.name,
          profileImage: profile.picture,
          roles: ['Rider']
        }
      });

      // Send welcome email to new user (non-blocking)
      const userName = user.firstName || user.email.split('@')[0];
      const welcomeEmail = emailTemplates.welcomeUser(userName);
      sendEmail({
        to: user.email,
        subject: welcomeEmail.subject,
        text: welcomeEmail.text,
        html: welcomeEmail.html
      }).catch(err => console.error('Failed to send welcome email:', err));
    } else if (!user.googleId) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id,
          profileImage: user.profileImage || profile.picture
        }
      });
    }
    
    const token = fastify.jwt.sign({ 
      id: user.id, 
      email: user.email 
    });
    
    return {
      token,
      user: sanitizeUser(user)
    };
  });

  // Get current user (replaces base44.auth.me())
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { email: request.user.email }
    });
    
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    
    return sanitizeUser(user);
  });

  // Update current user (replaces base44.auth.updateMe())
  fastify.patch('/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = updateMeSchema.parse(request.body);

    // Get current user to check for role changes
    const currentUser = await prisma.user.findUnique({
      where: { email: request.user.email }
    });

    if (!currentUser) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const oldRoles = currentUser.roles || [];

    // Build update data
    const updateData = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.roles !== undefined) updateData.roles = data.roles;
    if (data.profileImage !== undefined) updateData.profileImage = data.profileImage;
    if (data.birthday !== undefined) updateData.birthday = data.birthday ? new Date(data.birthday) : null;
    if (data.parentEmail !== undefined) updateData.parentEmail = data.parentEmail;
    if (data.dashboardCardOrder !== undefined) updateData.dashboardCardOrder = data.dashboardCardOrder;
    if (data.lockerNumber !== undefined) updateData.lockerNumber = data.lockerNumber;

    // Update fullName if firstName or lastName changed
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const firstName = data.firstName ?? currentUser.firstName;
      const lastName = data.lastName ?? currentUser.lastName;
      if (firstName && lastName) {
        updateData.fullName = `${firstName} ${lastName}`;
      }
    }

    const user = await prisma.user.update({
      where: { email: request.user.email },
      data: updateData
    });

    // Check for newly assigned roles and send welcome emails
    if (data.roles !== undefined) {
      const newRoles = data.roles || [];
      const userName = user.firstName || user.email.split('@')[0];

      // Check if Trainer role was newly assigned
      if (newRoles.includes('Trainer') && !oldRoles.includes('Trainer')) {
        const trainerEmail = emailTemplates.welcomeTrainer(userName);
        sendEmail({
          to: user.email,
          subject: trainerEmail.subject,
          text: trainerEmail.text,
          html: trainerEmail.html
        }).catch(err => console.error('Failed to send trainer welcome email:', err));
      }

      // Check if Parent/Guardian role was newly assigned
      if (newRoles.includes('Parent/Guardian') && !oldRoles.includes('Parent/Guardian')) {
        const guardianEmail = emailTemplates.welcomeGuardian(userName);
        sendEmail({
          to: user.email,
          subject: guardianEmail.subject,
          text: guardianEmail.text,
          html: guardianEmail.html
        }).catch(err => console.error('Failed to send guardian welcome email:', err));
      }
    }

    return sanitizeUser(user);
  });

  // Logout (client-side token removal, but we can track it server-side if needed)
  fastify.post('/logout', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // In a more sophisticated setup, we could blacklist the token here
    return { success: true };
  });

  // Verify token
  fastify.get('/verify', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    return { valid: true, user: request.user };
  });
}

// Helper to remove sensitive data from user object
function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    // Map to frontend expected format
    first_name: safeUser.firstName,
    last_name: safeUser.lastName,
    full_name: safeUser.fullName,
    profile_image: safeUser.profileImage,
    parent_email: safeUser.parentEmail,
    dashboard_card_order: safeUser.dashboardCardOrder,
    locker_number: safeUser.lockerNumber,
    created_date: safeUser.createdAt,
    updated_date: safeUser.updatedAt
  };
}
