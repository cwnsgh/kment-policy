import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { requireMallSession } from "@/lib/api/routeAuth";
import { logVariantRevision } from "@/lib/policy/variantRevisions";
import { MANAGED_POLICY_SLOT } from "@/types/policyPreset";

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

    const { data: existing, error: fetchErr } = await table()
      .select("id, mall_id, slot, label, body")
      .eq("id", id)
      .eq("mall_id", mall_id!)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.slot !== MANAGED_POLICY_SLOT) {
      return NextResponse.json(
        { error: "이 앱에서 관리하는 이용약관 항목만 수정할 수 있습니다." },
        { status: 403 }
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.label === "string") patch.label = body.label;
    if (typeof body.body === "string") patch.body = body.body;

    const labelChanged =
      typeof body.label === "string" && body.label !== existing.label;
    const bodyChanged =
      typeof body.body === "string" && body.body !== existing.body;

    if (labelChanged || bodyChanged) {
      void logVariantRevision({
        mall_id: mall_id!,
        variant_id: id,
        slot: existing.slot as string,
        label: existing.label as string,
        body: existing.body as string,
        action: "update",
      });
    }

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

  const { data: existing } = await table()
    .select("id, mall_id, slot, label, body")
    .eq("id", id)
    .eq("mall_id", mall_id!)
    .single();

  if (existing && existing.slot !== MANAGED_POLICY_SLOT) {
    return NextResponse.json(
      { error: "이 앱에서 관리하는 이용약관 항목만 삭제할 수 있습니다." },
      { status: 403 }
    );
  }

  if (existing) {
    void logVariantRevision({
      mall_id: mall_id!,
      variant_id: id,
      slot: existing.slot as string,
      label: existing.label as string,
      body: existing.body as string,
      action: "delete",
    });
  }

  const { error } = await table().delete().eq("id", id).eq("mall_id", mall_id!);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
