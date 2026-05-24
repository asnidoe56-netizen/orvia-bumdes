import { redirect } from "next/navigation";
import { getLoginContext } from "@/lib/auth/get-login-context";

export default async function AuthRedirectPage() {
  const context = await getLoginContext();

  if (!context?.role) {
    redirect("/login");
  }

  redirect(context.redirect_path);
}
