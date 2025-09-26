import { redirect } from "next/navigation";

export const metadata = {
  title: "Mot de passe oublié | ParagonCrisis",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  redirect("/");
}
