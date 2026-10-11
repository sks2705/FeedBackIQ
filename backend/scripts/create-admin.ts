import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args[0] || process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@feedbackiq.local';
  const passwordArg = args[1] || process.env.ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'AdminPassword123!';

  const email = emailArg.toLowerCase().trim();
  const password = passwordArg.trim();

  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password>');
    process.exit(1);
  }

  const bcryptLib = (bcrypt as unknown as { default?: typeof bcrypt; hash?: typeof bcrypt.hash });
  const hashFn = bcryptLib.hash || bcryptLib.default?.hash;
  if (!hashFn) {
    throw new Error('bcrypt hash function not found');
  }
  const passwordHash = await hashFn(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      email,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.log(`Successfully created/updated Admin user: ${user.email} (ID: ${user.id})`);
}

main()
  .catch((err) => {
    console.error('Error creating admin user:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
