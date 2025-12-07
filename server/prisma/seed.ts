
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Start seeding ...');

  // 1. Create Roles
  const roles = ['ADMIN', 'VENDOR', 'USER'];
  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    console.log(`Created role: ${role.name}`);
  }

  // 2. Create Admin User
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });

  if (adminRole) {
    const adminEmail = 'admin@example.com';
    const adminPasswordHash = await Bun.password.hash('admin123', {
      algorithm: "bcrypt",
      cost: 10,
    });

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: 'System Admin',
        roleId: adminRole.id,
      },
    });
    console.log(`Created admin user: ${admin.email}`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
