import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://inovasigorut.online";

function getLoginRedirectUrl(request: Request) {
  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";

  const isInternalHost =
    !rawHost || rawHost.includes("localhost") || rawHost.startsWith("127.");

  if (isInternalHost) {
    return new URL("/login", PUBLIC_SITE_URL);
  }

  const proto = request.headers.get("x-forwarded-proto") || "https";
  return new URL("/login", `${proto}://${rawHost}`);
}

export async function GET(request: Request) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(getLoginRedirectUrl(request), 303);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(getLoginRedirectUrl(request), 303);
}