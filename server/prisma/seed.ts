
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

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

  // 2. Create Users
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const vendorRole = await prisma.role.findUnique({ where: { name: 'VENDOR' } });

  if (!adminRole || !vendorRole) {
    throw new Error('Required roles not found');
  }

  const passwordHash = await bcrypt.hash('123456', 10);

  const users = [
    // Admins
    { email: 'admin@vbs.local', name: 'Admin', roleId: adminRole.id },
    { email: 'my@vbs.local', name: 'My Admin', roleId: adminRole.id },
    // Vendors
    {
      email: 'mujan@vbs.local',
      name: 'Mujan Vendor',
      roleId: vendorRole.id,
      vendor: {
        create: {
          companyName: 'Mujan Transport Co., Ltd.',
          taxId: '1234567890123',
          companyAddress: '123 Mujan Road, Bangkok',
          bankAccount: '123-4-56789-0',
          bankName: 'Kasikornbank',
          bankBranch: 'Silom'
        }
      }
    },
    {
      email: '168@vbs.local',
      name: '168 Vendor',
      roleId: vendorRole.id,
      vendor: {
        create: {
          companyName: '168 Logistics Co., Ltd.',
          taxId: '9876543210987',
          companyAddress: '456 168 Avenue, Bangkok',
          bankAccount: '987-6-54321-0',
          bankName: 'SCB',
          bankBranch: 'Sathorn'
        }
      }
    }
  ];

  for (const user of users) {
    if (!user.roleId) continue;

    // Separate vendor data from user data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { vendor, ...userData } = user;

    let vendorIdObj = {};

    // Handle Vendor creation first if exists
    if (vendor && vendor.create) {
      // Create or Find Vendor
      const existingVendor = await prisma.vendor.findUnique({
        where: { taxId: vendor.create.taxId }
      });

      if (existingVendor) {
        vendorIdObj = { vendorId: existingVendor.id };
        console.log(`Found existing vendor: ${existingVendor.companyName}`);
      } else {
        const newVendor = await prisma.vendor.create({
          data: vendor.create
        });
        vendorIdObj = { vendorId: newVendor.id };
        console.log(`Created new vendor: ${newVendor.companyName}`);
      }
    }

    // Now upsert user with vendorId if available
    const upsertData = {
      ...userData,
      passwordHash,
      ...vendorIdObj
    };

    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash, // Update password
        roleId: user.roleId,
        ...vendorIdObj // Link to vendor if applicable
      },
      create: upsertData,
    });
    console.log(`Upserted user: ${createdUser.email}`);
  }

  // 3. Create Company Settings (Bill To)
  const companySettings = await prisma.companySettings.findFirst();
  if (!companySettings) {
    await prisma.companySettings.create({
      data: {
        companyName: 'ABC SHIPPING SERVICE CO., LTD',
        companyAddress: '80 ซอยสุภาพงษ์ 3 แยก 8 แขวงหนองบอน เขตประเวศ กรุงเทพมหานคร 10250',
        taxId: '0205563001580',
        phone: '0852221266',
        email: 'admin@vbs.local'
      }
    });
    console.log('Created Company Settings (Bill To)');
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
