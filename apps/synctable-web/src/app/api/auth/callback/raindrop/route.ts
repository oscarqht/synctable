import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  STATE_COOKIE,
} from "@/lib/raindrop";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = new URL("/", request.url);

  if (error) {
    baseUrl.searchParams.set("error", errorDescription || error);
    return NextResponse.redirect(baseUrl);
  }

  if (!code) {
    baseUrl.searchParams.set("error", "No authorization code provided");
    return NextResponse.redirect(baseUrl);
  }

  const savedState = request.cookies.get(STATE_COOKIE)?.value;
  if (savedState && state && savedState !== state) {
    baseUrl.searchParams.set("error", "Invalid state parameter (CSRF protection)");
    return NextResponse.redirect(baseUrl);
  }

  try {
    const tokenData = await exchangeCodeForTokens(code);

    const redirectResponse = NextResponse.redirect(new URL("/", request.url));

    const maxAge = tokenData.expires_in || 60 * 60 * 24 * 30; // 30 days fallback

    redirectResponse.cookies.set(ACCESS_TOKEN_COOKIE, tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    if (tokenData.refresh_token) {
      redirectResponse.cookies.set(
        REFRESH_TOKEN_COOKIE,
        tokenData.refresh_token,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 90, // 90 days
        }
      );
    }

    // Clear state cookie
    redirectResponse.cookies.set(STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return redirectResponse;
  } catch (err: any) {
    baseUrl.searchParams.set(
      "error",
      err?.message || "Failed to exchange authorization code"
    );
    return NextResponse.redirect(baseUrl);
  }
}
