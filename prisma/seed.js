const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 10);
  const analystPassword = await bcrypt.hash("analyst123", 10);
  const viewerPassword = await bcrypt.hash("viewer123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@finance.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@finance.com",
      passwordHash: adminPassword,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: "analyst@finance.com" },
    update: {},
    create: {
      name: "Analyst User",
      email: "analyst@finance.com",
      passwordHash: analystPassword,
      role: "ANALYST",
      status: "ACTIVE",
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@finance.com" },
    update: {},
    create: {
      name: "Viewer User",
      email: "viewer@finance.com",
      passwordHash: viewerPassword,
      role: "VIEWER",
      status: "ACTIVE",
    },
  });

  // Seed sample financial records
  const categories = ["Salary", "Rent", "Utilities", "Groceries", "Marketing", "Software", "Freelance", "Investment"];
  const records = [];

  for (let i = 0; i < 30; i++) {
    const isIncome = i % 3 !== 0;
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));

    records.push({
      amount: parseFloat((Math.random() * 5000 + 100).toFixed(2)),
      type: isIncome ? "INCOME" : "EXPENSE",
      category: categories[Math.floor(Math.random() * categories.length)],
      date,
      notes: `Sample record ${i + 1}`,
      createdById: i % 2 === 0 ? admin.id : analyst.id,
    });
  }

  await prisma.financialRecord.createMany({ data: records });

  console.log("✅ Seed complete");
  console.log("\n📋 Test credentials:");
  console.log("  Admin:   admin@finance.com   / admin123");
  console.log("  Analyst: analyst@finance.com / analyst123");
  console.log("  Viewer:  viewer@finance.com  / viewer123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });