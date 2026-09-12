import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.contact.count();
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} contacts already present.`);
    return;
  }

  const contactsData = [
    {
      name: "Ava Thompson",
      email: "ava.thompson@northwind.io",
      phone: "+1 415 555 0142",
      company: "Northwind Labs",
      title: "VP of Engineering",
      status: "Active",
      notes: "Champion for the platform rollout.",
    },
    {
      name: "Marcus Lee",
      email: "marcus.lee@brightpath.com",
      phone: "+1 212 555 0198",
      company: "BrightPath",
      title: "Head of Sales",
      status: "Active",
      notes: "Prefers email over calls.",
    },
    {
      name: "Priya Nair",
      email: "priya.nair@cloudspring.dev",
      phone: "+44 20 7946 0321",
      company: "CloudSpring",
      title: "Product Manager",
      status: "Lead",
      notes: "Met at SaaS Summit 2026.",
    },
    {
      name: "Diego Fernandez",
      email: "diego@lumaworks.co",
      phone: "+34 91 555 0177",
      company: "Lumaworks",
      title: "CTO",
      status: "Lead",
      notes: null,
    },
    {
      name: "Sarah Okafor",
      email: "sarah.okafor@meridian.finance",
      phone: "+1 646 555 0111",
      company: "Meridian Finance",
      title: "COO",
      status: "Inactive",
      notes: "Budget frozen until next quarter.",
    },
  ];

  const contacts = [];
  for (const data of contactsData) {
    contacts.push(await prisma.contact.create({ data }));
  }

  const dealsData = [
    { title: "Northwind platform license", value: 48000, stage: "Proposal", contactId: contacts[0].id },
    { title: "Northwind onboarding services", value: 12000, stage: "Won", contactId: contacts[0].id },
    { title: "BrightPath annual renewal", value: 36000, stage: "Qualified", contactId: contacts[1].id },
    { title: "CloudSpring pilot", value: 8000, stage: "Lead", contactId: contacts[2].id },
    { title: "Lumaworks integration", value: 21500, stage: "Proposal", contactId: contacts[3].id },
    { title: "Meridian expansion", value: 60000, stage: "Lost", contactId: contacts[4].id },
    { title: "BrightPath add-on seats", value: 9500, stage: "Won", contactId: contacts[1].id },
  ];

  for (const data of dealsData) {
    await prisma.deal.create({ data });
  }

  console.log(
    `Seeded ${contacts.length} contacts and ${dealsData.length} deals.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
