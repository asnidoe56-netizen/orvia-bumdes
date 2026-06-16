import { NextResponse } from "next/server";
import { getAiSupplierPayables } from "@/lib/orvia-ai/read-tools";

export async function GET() {
  try {
    const result = await getAiSupplierPayables(
      "Uji baca daftar hutang supplier melalui endpoint ORVIA AI."
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal membaca hutang supplier ORVIA AI.";

    return NextResponse.json(
      {
        mode: "read_only",
        tool: "orvia.read.supplier_payables",
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
