import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const refresh = jar.get("whoop_refresh")?.value || "";
  const access = jar.get("whoop_access")?.value || "";
  const res = NextResponse.json({
    connected: Boolean(refresh || access),
    hasRefresh: Boolean(refresh),
    hasAccess: Boolean(access),
  });
  return res;
}

