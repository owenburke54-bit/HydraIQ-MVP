import { bad, getRouteClient, ok, requireUserId } from "../_helpers";

export async function GET() {
\ttry {
\t\tconst userId = await requireUserId();
\t\tconst supabase = getRouteClient();
\t\tconst { data } = await supabase
\t\t\t.from(\"profiles\")
\t\t\t.select(\"name, sex, dob, height_cm, weight_kg, units\")
\t\t\t.eq(\"id\", userId)
\t\t\t.maybeSingle();
\t\treturn ok(data ?? {});
\t} catch (e: any) {
\t\tif (e instanceof Response) return e;
\t\treturn bad(\"Unexpected error\", 500);
\t}
}

export async function POST(request: Request) {
\ttry {
\t\tconst userId = await requireUserId();
\t\tconst body = await request.json();
\t\tconst name: string | undefined = body?.name;
\t\tconst sex = (body?.sex as string) ?? \"other\";
\t\tconst units = (body?.units as string) ?? \"imperial\";
\t\tlet height_cm: number | null = null;
\t\tlet weight_kg: number | null = null;
\t\tif (units === \"metric\") {
\t\t\theight_cm = Number(body?.heightCm) || null;
\t\t\tweight_kg = Number(body?.weightKg) || null;
\t\t} else {
\t\t\t// Convert imperial to metric
\t\t\tconst heightStr: string = body?.heightImperial ?? \"\"; // e.g., 5'10
\t\t\tconst match = heightStr.match(/(\\d+)'(\\d+)/);
\t\t\tif (match) {
\t\t\t\tconst ft = Number(match[1]) || 0;
\t\t\t\tconst inches = Number(match[2]) || 0;
\t\t\t\theight_cm = Math.round((ft * 12 + inches) * 2.54);
\t\t\t}
\t\t\tconst weightLbs: number = Number(body?.weightLbs) || 0;
\t\t\tweight_kg = weightLbs ? Math.round(weightLbs * 0.453592) : null;
\t\t}
\t\tconst supabase = getRouteClient();
\t\tconst { error } = await supabase.from(\"profiles\").upsert(
\t\t\t{
\t\t\t\tid: userId,
\t\t\t\tname: name ?? null,
\t\t\t\tsex,
\t\t\t\theight_cm,
\t\t\t\tweight_kg,
\t\t\t\tunits,
\t\t\t},
\t\t\t{ onConflict: \"id\" }
\t\t);
\t\tif (error) return bad(\"Failed to save profile\", 500);
\t\treturn ok({ success: true });
\t} catch (e: any) {
\t\tif (e instanceof Response) return e;
\t\treturn bad(\"Unexpected error\", 500);
\t}
}


