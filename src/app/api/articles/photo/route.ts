import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// Photo d'un article, servie comme une image.
//
// GET /api/articles/photo?refArt=XXX  -> image/jpeg (404 sans photo)
//
// La photo vit en base (data URL) ; la servir à part évite d'embarquer des
// centaines de Ko dans chaque ligne des listes et du catalogue, qui ne
// transportent qu'un indicateur `aPhoto`.
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;
  const refArt = req.nextUrl.searchParams.get("refArt") ?? "";
  if (!refArt) return new NextResponse(null, { status: 400 });
  const a = await prisma.article.findUnique({ where: { refArt }, select: { photo: true } });
  const m = a?.photo?.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (!m) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=300" },
  });
}
