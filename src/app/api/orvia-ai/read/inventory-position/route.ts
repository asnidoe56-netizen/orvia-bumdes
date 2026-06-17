import { NextResponse } from "next/server";
import { getAiInventoryPosition } from "@/lib/orvia-ai/read-tools";

export async function GET() {
  try {
    const result = await getAiInventoryPosition(
      "Uji baca posisi stok barang melalui endpoint ORVIA AI."
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal membaca posisi stok barang ORVIA AI.";

    return NextResponse.json(
      {
        mode: "read_only",
        tool: "orvia.read.inventory_position",
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
