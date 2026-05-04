import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { requireMallSession } from "@/lib/api/routeAuth";

function table() {
  return supabaseAdmin.schema(POLICY_SCHEMA).from("policy_text_variants");
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const mall_id = body.mall_id as string | undefined;
    const auth = await requireMallSession(req, mall_id ?? null);
    if (auth) return auth;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.label === "string") patch.label = body.label;
    if (typeof body.body === "string") patch.body = body.body;

    const { data, error } = await table()
      .update(patch)
      .eq("id", id)
      .eq("mall_id", mall_id!)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ variant: data });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const mall_id = req.nextUrl.searchParams.get("mall_id");
  const auth = await requireMallSession(req, mall_id);
  if (auth) return auth;

  const { error } = await table().delete().eq("id", id).eq("mall_id", mall_id!);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
