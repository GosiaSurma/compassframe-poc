import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  // The (app) layout handles the onboarding prompt when role is unset
  redirect("/reflection")
}
