const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function updateSuperadmin() {
  try {
    console.log('Updating superadmin user...');
    
    // Find existing superadmin
    const existingSuperadmin = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' }
    });
    
    if (existingSuperadmin) {
      console.log(`Found existing superadmin: ${existingSuperadmin.email} with ${existingSuperadmin.coins} coins`);
      
      // Update the superadmin with correct values
      const updatedSuperadmin = await prisma.user.update({
        where: { id: existingSuperadmin.id },
        data: {
          email: 'superadmin@cbums.com',
          coins: 1000000,
          updatedAt: new Date()
        }
      });
      
      console.log('Superadmin updated successfully:');
      console.log(`- Email: ${updatedSuperadmin.email}`);
      console.log(`- Coins: ${updatedSuperadmin.coins}`);
    } else {
      console.log('No superadmin found. Creating new superadmin...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash('superadmin123', 10);
      
      // Create superadmin with correct values
      const newSuperadmin = await prisma.user.create({
        data: {
          id: uuidv4(),
          name: 'Super Admin',
          email: 'superadmin@cbums.com',
          password: hashedPassword,
          role: 'SUPERADMIN',
          coins: 1000000,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log('New superadmin created successfully:');
      console.log(`- Email: ${newSuperadmin.email}`);
      console.log(`- Coins: ${newSuperadmin.coins}`);
    }
  } catch (error) {
    console.error('Error updating superadmin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSuperadmin(); 