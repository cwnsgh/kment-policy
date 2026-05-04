import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const session = await getSession(request);

    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "?error=unauthorized";
      return NextResponse.redirect(url);
    }

    const mallId = request.nextUrl.searchParams.get("mall_id");
    if (mallId && session.mall_id !== mallId) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "?error=unauthorized";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
