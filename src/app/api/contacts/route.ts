import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CONTACT_STATUSES } from "@/lib/crm";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deals: true } } },
  });
  return NextResponse.json(contacts);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 }
    );
  }

  const status =
    typeof body.status === "string" &&
    CONTACT_STATUSES.includes(body.status as (typeof CONTACT_STATUSES)[number])
      ? body.status
      : "Lead";

  try {
    const contact = await prisma.contact.create({
      data: {
        name,
        email,
        status,
        phone: strOrNull(body.phone),
        company: strOrNull(body.company),
        title: strOrNull(body.title),
        notes: strOrNull(body.notes),
      },
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    if (isUniqueError(error)) {
      return NextResponse.json(
        { error: "A contact with this email already exists" },
        { status: 409 }
      );
    }
    throw error;
  }
}

function strOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
