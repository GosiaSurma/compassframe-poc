// This route is inside the (app) layout which now handles onboarding inline.
// A direct navigation to /onboarding when the user already has a role just
// bounces them back to the app.
import { redirect } from "next/navigation"

export default function OnboardingRedirect() {
  redirect("/reflection")
}
