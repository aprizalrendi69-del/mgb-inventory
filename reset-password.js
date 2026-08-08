const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const username = "admin";
  const newPassword = "Mgb0413";

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: {
      username,
    },
    data: {
      password: hashedPassword,
    },
  });

  console.log("=================================");
  console.log("PASSWORD ADMIN BERHASIL DI RESET");
  console.log("Username :", username);
  console.log("Password :", newPassword);
  console.log("=================================");
}

main()
  .catch((error) => {
    console.error("RESET PASSWORD ERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });