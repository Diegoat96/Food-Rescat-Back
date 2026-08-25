import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('4cminGUANtwoTHREE', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@Foodrescat.com' },
    update: {},
    create: {
      name: 'Admin-Foodrescat',
      email: 'admin@Foodrescat.com',
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log({ admin });

  // Initial categories (upsert keeps re-runs idempotent)
  const categorySeedData = [
    'Panadería',
    'Comida preparada',
    'Frutas y verduras',
    'Lácteos',
    'Otros',
  ];

  for (const categoryName of categorySeedData) {
    await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
  }

  console.log(`Seeded ${categorySeedData.length} categories`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
