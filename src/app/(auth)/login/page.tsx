import { redirect } from "next/navigation";

export const metadata = {
  title: "Connexion | ParagonCrisis",
  robots: { index: false },
};

export default function LoginPage() {
  redirect("/");
}
