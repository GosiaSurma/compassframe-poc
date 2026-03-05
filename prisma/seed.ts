/**
 * Seed two pre-verified test users (parent + teen) linked together.
 *
 * Run:  npx tsx prisma/seed.ts
 *
 * Credentials:
 *   parent@test.com  /  Test1234!
 *   teen@test.com    /  Test1234!
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash("Test1234!", 12)
  const now = new Date()

  const parent = await prisma.user.upsert({
    where: { email: "parent@test.com" },
    update: {},
    create: {
      email: "parent@test.com",
      name: "Alex (Parent)",
      passwordHash: password,
      emailVerified: now,
      role: "parent",
    },
  })

  const teen = await prisma.user.upsert({
    where: { email: "teen@test.com" },
    update: {},
    create: {
      email: "teen@test.com",
      name: "Jordan (Teen)",
      passwordHash: password,
      emailVerified: now,
      role: "teen",
    },
  })

  await prisma.relationship.upsert({
    where: { parentId_teenId: { parentId: parent.id, teenId: teen.id } },
    update: {},
    create: { parentId: parent.id, teenId: teen.id, status: "active" },
  })

  console.log("✓ Seeded:")
  console.log("  parent@test.com  /  Test1234!  (role: parent, linked to teen)")
  console.log("  teen@test.com    /  Test1234!  (role: teen,   linked to parent)")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
