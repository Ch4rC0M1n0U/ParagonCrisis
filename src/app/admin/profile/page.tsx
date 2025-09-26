import { redirect } from "next/navigation";

export const metadata = {
  title: "Profil | ParagonCrisis",
};

export default function AdminProfileRedirectPage() {
  redirect("/profile");
}
