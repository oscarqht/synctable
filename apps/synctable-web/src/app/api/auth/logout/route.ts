import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  STATE_COOKIE,
} from "@/lib/raindrop";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true });

  const clearCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  response.cookies.set(ACCESS_TOKEN_COOKIE, "", clearCookieOptions);
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", clearCookieOptions);
  response.cookies.set(STATE_COOKIE, "", clearCookieOptions);

  return response;
}
