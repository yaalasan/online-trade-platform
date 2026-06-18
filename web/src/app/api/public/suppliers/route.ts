import { NextResponse } from "next/server";
import { listPublicSuppliers } from "@/lib/catalog";
import { shapeSupplierCard } from "@/lib/public-api";

/** Public supplier directory: manufacturers with at least one ACTIVE product. */
export async function GET() {
  const suppliers = await listPublicSuppliers();
  return NextResponse.json({ suppliers: suppliers.map(shapeSupplierCard) });
}
