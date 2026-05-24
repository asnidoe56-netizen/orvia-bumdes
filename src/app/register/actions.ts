"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RegisterBumdesState = {
    success: boolean;
    message: string;
    registrationId?: string;
};

export async function submitBumdesRegistration(
    _prevState: RegisterBumdesState,
    formData: FormData
): Promise<RegisterBumdesState> {
    const supabase = await createClient();

    const payload = {
        p_nama_bumdes: String(formData.get("nama_bumdes") ?? ""),
        p_kode_bumdes: String(formData.get("kode_bumdes") ?? ""),
        p_nama_desa: String(formData.get("nama_desa") ?? ""),
        p_nama_kecamatan: String(formData.get("nama_kecamatan") ?? ""),
        p_alamat: String(formData.get("alamat") ?? ""),
        p_nomor_whatsapp: String(formData.get("nomor_whatsapp") ?? ""),
        p_email: String(formData.get("email") ?? ""),
        p_requester_name: String(formData.get("requester_name") ?? ""),
        p_requester_phone: String(formData.get("requester_phone") ?? ""),
        p_requester_email: String(formData.get("requester_email") ?? ""),
    };

    const { data, error } = await supabase.rpc(
        "submit_tenant_registration",
        payload
    );

    if (error) {
        return {
            success: false,
            message: error.message || "Pendaftaran BUMDes gagal dikirim.",
        };
    }

    revalidatePath("/register");
    revalidatePath("/platform/dashboard/registrations");

    return {
        success: true,
        message: "Pendaftaran BUMDes berhasil dikirim dan menunggu approval platform.",
        registrationId: data,
    };
}