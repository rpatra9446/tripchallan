const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting database seeding...');
    
    // Create superadmin user
    const superadminEmail = 'superadmin@cbums.com';
    
    // Check if superadmin already exists
    const existingSuperadmin = await prisma.user.findUnique({
      where: { email: superadminEmail }
    });
    
    if (existingSuperadmin) {
      console.log('Superadmin user already exists, updating...');
      
      // Update superadmin with correct values
      const updatedSuperadmin = await prisma.user.update({
        where: { email: superadminEmail },
        data: {
          coins: 1000000,
          updatedAt: new Date()
        }
      });
      
      console.log(`Superadmin updated with email: ${superadminEmail} and coins: ${updatedSuperadmin.coins}`);
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash('superadmin123', 10);
      
      // Create superadmin
      const superadmin = await prisma.user.create({
        data: {
          id: uuidv4(),
          name: 'Super Admin',
          email: superadminEmail,
          password: hashedPassword,
          role: 'SUPERADMIN',
          coins: 1000000,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log(`Superadmin created with email: ${superadminEmail} and coins: ${superadmin.coins}`);
    }
    
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
