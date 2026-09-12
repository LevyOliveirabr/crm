import { prisma } from "@/lib/prisma";
import { DealsClient } from "./DealsClient";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [deals, contacts] = await Promise.all([
    prisma.deal.findMany({
      orderBy: { createdAt: "desc" },
      include: { contact: true },
    }),
    prisma.contact.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <DealsClient initialDeals={deals} contacts={contacts} />;
}
