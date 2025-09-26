import { redirect } from "next/navigation";

export const metadata = {
  title: "Inscription | ParagonCrisis",
  robots: { index: false },
};

export default function RegisterPage() {
  redirect("/");
}
