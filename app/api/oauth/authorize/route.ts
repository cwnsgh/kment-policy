import { NextRequest, NextResponse } from "next/server";
import { cafe24Scopes } from "@/lib/constants/cafe24Scopes";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mall_id = searchParams.get("mall_id");
  const state = searchParams.get("state");

  if (!mall_id) {
    return NextResponse.json(
      { error: "Missing mall_id parameter" },
      { status: 400 },
    );
  }

  if (!state) {
    return NextResponse.json(
      { error: "Missing state parameter" },
      { status: 400 },
    );
  }

  if (!state.startsWith(`${mall_id}:`)) {
    return NextResponse.json(
      { error: "Invalid state format" },
      { status: 400 },
    );
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .schema(POLICY_SCHEMA)
    .from("oauth_states")
    .insert({
      state,
      mall_id,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error("State 저장 실패:", error);
    return NextResponse.json(
      {
        error: "Failed to save state",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
        code: error.code,
      },
      { status: 500 },
    );
  }

  const authorizeUrl = new URL(
    `https://${mall_id}.cafe24api.com/api/v2/oauth/authorize`,
  );

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", process.env.CAFE24_CLIENT_ID!);
  authorizeUrl.searchParams.set(
    "redirect_uri",
    process.env.CAFE24_REDIRECT_URI!,
  );
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", cafe24Scopes.join(" "));

  return NextResponse.redirect(authorizeUrl.toString());
}
