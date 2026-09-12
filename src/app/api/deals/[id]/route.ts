import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEAL_STAGES } from "@/lib/crm";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/deals/[id]">
) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    data.title = title;
  }
  if ("value" in body) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json(
        { error: "Value must be a non-negative number" },
        { status: 400 }
      );
    }
    data.value = value;
  }
  if (
    typeof body.stage === "string" &&
    DEAL_STAGES.includes(body.stage as (typeof DEAL_STAGES)[number])
  ) {
    data.stage = body.stage;
  }
  if ("contactId" in body) {
    const contactId =
      typeof body.contactId === "string" && body.contactId.length
        ? body.contactId
        : null;
    if (contactId) {
      const exists = await prisma.contact.findUnique({
        where: { id: contactId },
      });
      if (!exists) {
        return NextResponse.json(
          { error: "Selected contact does not exist" },
          { status: 400 }
        );
      }
    }
    data.contactId = contactId;
  }

  try {
    const deal = await prisma.deal.update({
      where: { id },
      data,
      include: { contact: true },
    });
    return NextResponse.json(deal);
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/deals/[id]">
) {
  const { id } = await ctx.params;
  try {
    await prisma.deal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
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
