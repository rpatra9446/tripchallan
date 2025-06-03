const { PrismaClient, UserRole } = require('@prisma/client');

// Initialize the Prisma Client
const prisma = new PrismaClient();

async function main() {
  console.log('Starting to fix company owner relationships...');

  try {
    // Find all users with role = COMPANY
    const companyUsers = await prisma.user.findMany({
      where: {
        role: UserRole.COMPANY,
      }
    });

    console.log(`Found ${companyUsers.length} company users`);

    // Process each company user
    for (const user of companyUsers) {
      // Check if they already have an ownedCompany relationship
      const existingOwnerRelation = await prisma.companyOwner.findFirst({
        where: {
          userId: user.id
        }
      });

      if (existingOwnerRelation) {
        console.log(`User ${user.id} (${user.name}) already has an ownedCompany relationship. Skipping.`);
        continue;
      }

      // Find their company (either via companyId or direct match)
      let companyId = user.companyId;

      // If companyId is not set, try to find a company with matching email
      if (!companyId) {
        const company = await prisma.company.findFirst({
          where: {
            email: user.email
          }
        });

        if (company) {
          companyId = company.id;
          
          // Also update the user's companyId
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId: company.id }
          });
          
          console.log(`Updated user ${user.id} (${user.name}) with missing companyId: ${company.id}`);
        }
      }

      // If we have a companyId, create the CompanyOwner relationship
      if (companyId) {
        try {
          // Create the CompanyOwner relationship
          const companyOwner = await prisma.companyOwner.create({
            data: {
              userId: user.id,
              companyId: companyId
            }
          });
          
          console.log(`Created CompanyOwner relationship for user ${user.id} (${user.name}) and company ${companyId}`);
        } catch (err) {
          console.error(`Error creating CompanyOwner for user ${user.id} (${user.name}):`, err);
        }
      } else {
        console.log(`No company found for user ${user.id} (${user.name}). Creating a new company.`);
        
        // Create a new company for this user
        const company = await prisma.company.create({
          data: {
            name: user.name,
            email: user.email,
            isActive: true
          }
        });
        
        // Update the user with the new companyId
        await prisma.user.update({
          where: { id: user.id },
          data: { companyId: company.id }
        });
        
        // Create the CompanyOwner relationship
        const companyOwner = await prisma.companyOwner.create({
          data: {
            userId: user.id,
            companyId: company.id
          }
        });
        
        console.log(`Created new company ${company.id} and CompanyOwner relationship for user ${user.id} (${user.name})`);
      }
    }

    console.log('Finished fixing company owner relationships!');
  } catch (err) {
    console.error('Error fixing company owner relationships:', err);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .then(() => console.log('Script completed successfully'))
  .catch((err) => console.error('Script failed:', err)); 