import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEAL_STAGES } from "@/lib/crm";

export async function GET() {
  const deals = await prisma.deal.findMany({
    orderBy: { createdAt: "desc" },
    include: { contact: true },
  });
  return NextResponse.json(deals);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const value = Number(body.value);
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json(
      { error: "Value must be a non-negative number" },
      { status: 400 }
    );
  }

  const stage =
    typeof body.stage === "string" &&
    DEAL_STAGES.includes(body.stage as (typeof DEAL_STAGES)[number])
      ? body.stage
      : "Lead";

  const contactId =
    typeof body.contactId === "string" && body.contactId.length
      ? body.contactId
      : null;

  if (contactId) {
    const exists = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!exists) {
      return NextResponse.json(
        { error: "Selected contact does not exist" },
        { status: 400 }
      );
    }
  }

  const deal = await prisma.deal.create({
    data: { title, value, stage, contactId },
    include: { contact: true },
  });
  return NextResponse.json(deal, { status: 201 });
}
