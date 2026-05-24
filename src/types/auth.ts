export type AppRole =
  | "super_admin_platform"
  | "direktur_bumdes"
  | "admin_bumdes"
  | "manager_unit"
  | "operator_unit"
  | "viewer_unit"
  | "pengawas"
  | "pendamping_kecamatan"
  | "pendamping"
  | "dinas_pmd"
  | "inspektorat"
  | "bupati";

export type LoginContext = {
  user_id: string;
  role: AppRole | null;
  tenant_id: string | null;
  unit_id: string | null;
  redirect_path: string;
  full_name?: string | null;
};

