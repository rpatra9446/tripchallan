const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSuperadmin() {
  try {
    console.log('Checking for superadmin user...');
    
    const superadmins = await prisma.user.findMany({
      where: {
        role: 'SUPERADMIN'
      }
    });
    
    if (superadmins.length === 0) {
      console.log('No superadmin users found in the database!');
    } else {
      console.log(`Found ${superadmins.length} superadmin users:`);
      superadmins.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
      });
    }
  } catch (error) {
    console.error('Error checking for superadmin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSuperadmin();
