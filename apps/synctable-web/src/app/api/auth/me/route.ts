import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, fetchRaindropUser } from "@/lib/raindrop";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const token = authHeader || request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }


  const user = await fetchRaindropUser(token);

  if (!user) {
    const response = NextResponse.json({ user: null });
    // Token is no longer valid, clear cookie
    response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  return NextResponse.json({ user });
}
