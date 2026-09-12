import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CONTACT_STATUSES } from "@/lib/crm";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/contacts/[id]">
) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = name;
  }
  if (typeof body.email === "string") {
    const email = body.email.trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }
    data.email = email;
  }
  if (
    typeof body.status === "string" &&
    CONTACT_STATUSES.includes(body.status as (typeof CONTACT_STATUSES)[number])
  ) {
    data.status = body.status;
  }
  for (const key of ["phone", "company", "title", "notes"] as const) {
    if (key in body) {
      const value = body[key];
      data[key] =
        typeof value === "string" && value.trim().length
          ? value.trim()
          : null;
    }
  }

  try {
    const contact = await prisma.contact.update({ where: { id }, data });
    return NextResponse.json(contact);
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    if (isUniqueError(error)) {
      return NextResponse.json(
        { error: "A contact with this email already exists" },
        { status: 409 }
      );
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/contacts/[id]">
) {
  const { id } = await ctx.params;
  try {
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
