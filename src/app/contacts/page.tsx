import { prisma } from "@/lib/prisma";
import { ContactsClient } from "./ContactsClient";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deals: true } } },
  });

  return <ContactsClient initialContacts={contacts} />;
}
