import { NextResponse } from "next/server";
import { getAiCustomerReceivables } from "@/lib/orvia-ai/read-tools";

export async function GET() {
  try {
    const result = await getAiCustomerReceivables(
      "Uji baca daftar piutang pelanggan melalui endpoint ORVIA AI."
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal membaca piutang pelanggan ORVIA AI.";

    return NextResponse.json(
      {
        mode: "read_only",
        tool: "orvia.read.customer_receivables",
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
