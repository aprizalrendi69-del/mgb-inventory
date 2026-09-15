import { NextRequest } from "next/server";
import { POST as canonicalPOST } from "../../sales/[id]/void/route";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return canonicalPOST(req, context);
}
