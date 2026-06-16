import { NextResponse } from "next/server";
import { getAiCashBankPosition } from "@/lib/orvia-ai/read-tools";

export async function GET() {
  try {
    const result = await getAiCashBankPosition(
      "Uji baca posisi kas/bank melalui endpoint ORVIA AI."
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal membaca posisi kas/bank ORVIA AI.";

    return NextResponse.json(
      {
        mode: "read_only",
        tool: "orvia.read.cash_bank_position",
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
