import { NextResponse } from "next/server";
import { getAiUnitHealthSummary } from "@/lib/orvia-ai/read-tools";

export async function GET() {
  try {
    const result = await getAiUnitHealthSummary(
      "Uji baca ringkasan kesehatan unit melalui endpoint ORVIA AI."
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal membaca ringkasan kesehatan unit ORVIA AI.";

    return NextResponse.json(
      {
        mode: "read_only",
        tool: "orvia.read.unit_health_summary",
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
