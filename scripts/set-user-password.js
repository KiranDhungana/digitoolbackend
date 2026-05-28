require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: node scripts/set-user-password.js <email> <password>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    console.error(`No user found with email: ${normalizedEmail}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { email: normalizedEmail },
    data: { passwordHash },
  });

  console.log(`Password updated for ${updated.name} (${updated.email})`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
