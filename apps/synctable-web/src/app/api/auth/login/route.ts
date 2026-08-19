import { NextResponse } from "next/server";
import { getAuthorizationUrl, STATE_COOKIE } from "@/lib/raindrop";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = crypto.randomUUID();
  const authUrl = getAuthorizationUrl(state);

  const response = NextResponse.redirect(authUrl);

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
