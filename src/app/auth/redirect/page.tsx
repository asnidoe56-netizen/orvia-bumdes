import { redirect } from "next/navigation";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { getFallbackRedirectPath } from "@/lib/navigation/role-routes";

export default async function AuthRedirectPage() {
  const context = await getLoginContext();

  if (!context?.role) {
    redirect("/login");
  }

  const fallbackPath = getFallbackRedirectPath(context.role);
  const targetPath =
    context.redirect_path && context.redirect_path !== "/login"
      ? context.redirect_path
      : fallbackPath;

  redirect(targetPath);
}
