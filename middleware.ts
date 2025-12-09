import { NextResponse, type NextRequest } from "next/server";

// Temporary: disable auth middleware to allow app access without login
export async function middleware(_req: NextRequest) {
	return NextResponse.next();
}

export const config = {
	matcher: ["/(.*)"],
};


