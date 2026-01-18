import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ridersos.app' },
    update: {},
    create: {
      email: 'admin@ridersos.app',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      fullName: 'Admin User',
      roles: ['Admin'],
    },
  });
  console.log('Created admin user:', admin.email);

  // Create a sample trainer
  const trainerPasswordHash = await bcrypt.hash('trainer123', 10);
  const trainer = await prisma.user.upsert({
    where: { email: 'trainer@example.com' },
    update: {},
    create: {
      email: 'trainer@example.com',
      passwordHash: trainerPasswordHash,
      firstName: 'Sarah',
      lastName: 'Johnson',
      fullName: 'Sarah Johnson',
      roles: ['Trainer'],
    },
  });
  console.log('Created trainer user:', trainer.email);

  // Create a sample rider
  const riderPasswordHash = await bcrypt.hash('rider123', 10);
  const rider = await prisma.user.upsert({
    where: { email: 'rider@example.com' },
    update: {},
    create: {
      email: 'rider@example.com',
      passwordHash: riderPasswordHash,
      firstName: 'Alex',
      lastName: 'Smith',
      fullName: 'Alex Smith',
      roles: ['Rider'],
    },
  });
  console.log('Created rider user:', rider.email);

  // Create a sample stable manager
  const managerPasswordHash = await bcrypt.hash('manager123', 10);
  const stableManager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      passwordHash: managerPasswordHash,
      firstName: 'Mike',
      lastName: 'Brown',
      fullName: 'Mike Brown',
      roles: ['StableManager'],
    },
  });
  console.log('Created stable manager:', stableManager.email);

  // Create a sample stable
  const stable = await prisma.stable.upsert({
    where: { id: 'sample-stable-1' },
    update: {},
    create: {
      id: 'sample-stable-1',
      name: 'Sunny Meadows Equestrian Center',
      managerEmail: stableManager.email,
      address: '123 Horse Lane',
      city: 'Horseville',
      state: 'CA',
      country: 'USA',
      phone: '+1-555-123-4567',
      email: 'info@sunnymeadows.com',
      description: 'A premier equestrian facility offering top-notch training and boarding services.',
      approvalStatus: 'APPROVED',
    },
  });
  console.log('Created stable:', stable.name);

  // Create a sample horse for the rider
  const horse = await prisma.horse.upsert({
    where: { id: 'sample-horse-1' },
    update: {},
    create: {
      id: 'sample-horse-1',
      ownerEmail: rider.email,
      name: 'Thunder',
      homeStableName: stable.name,
      breed: 'Thoroughbred',
      birthYear: 2018,
      color: 'Bay',
      height: '16.2 hands',
      description: 'A spirited and athletic horse with excellent jumping ability.',
    },
  });
  console.log('Created horse:', horse.name);

  // Create a connection between trainer and rider
  const connection = await prisma.userConnection.upsert({
    where: {
      fromUserEmail_toUserEmail_connectionType: {
        fromUserEmail: trainer.email,
        toUserEmail: rider.email,
        connectionType: 'Trainer-Rider',
      },
    },
    update: {},
    create: {
      fromUserEmail: trainer.email,
      toUserEmail: rider.email,
      connectionType: 'Trainer-Rider',
      status: 'APPROVED',
    },
  });
  console.log('Created trainer-rider connection');

  // Create billing rates for the trainer
  const sessionTypes = ['LESSON', 'TRAINING', 'HORSE_TRAINING', 'EVALUATION'];
  const rates = [150, 200, 175, 100];

  for (let i = 0; i < sessionTypes.length; i++) {
    await prisma.billingRate.upsert({
      where: {
        trainerEmail_sessionType: {
          trainerEmail: trainer.email,
          sessionType: sessionTypes[i],
        },
      },
      update: {},
      create: {
        trainerEmail: trainer.email,
        sessionType: sessionTypes[i],
        currency: 'USD',
        rate: rates[i],
      },
    });
  }
  console.log('Created billing rates for trainer');

  // Create a sample training session
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);

  const session = await prisma.trainingSession.create({
    data: {
      trainerEmail: trainer.email,
      riderEmail: rider.email,
      riderName: rider.fullName,
      horseName: horse.name,
      sessionDate: nextWeek,
      duration: 60,
      sessionType: 'LESSON',
      notes: 'Focus on jumping technique',
      status: 'SCHEDULED',
    },
  });
  console.log('Created sample training session for', nextWeek.toDateString());

  // Create notification preferences for all users
  const users = [admin, trainer, rider, stableManager];
  const notificationTypes = [
    'SESSION_SCHEDULED',
    'SESSION_CANCELLED',
    'PAYMENT_REQUEST',
    'CONNECTION_REQUEST',
    'HORSE_CARE_REMINDER',
  ];

  for (const user of users) {
    for (const notificationType of notificationTypes) {
      await prisma.notificationPreference.upsert({
        where: {
          userEmail_notificationType: {
            userEmail: user.email,
            notificationType: notificationType,
          },
        },
        update: {},
        create: {
          userEmail: user.email,
          notificationType: notificationType,
          emailEnabled: true,
          inAppEnabled: true,
        },
      });
    }
  }
  console.log('Created notification preferences for all users');

  console.log('\n--- Seed completed successfully! ---\n');
  console.log('Test accounts created:');
  console.log('  Admin:    admin@ridersos.app / admin123');
  console.log('  Trainer:  trainer@example.com / trainer123');
  console.log('  Rider:    rider@example.com / rider123');
  console.log('  Manager:  manager@example.com / manager123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
