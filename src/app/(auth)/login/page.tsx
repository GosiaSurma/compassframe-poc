import { LoginForm } from "./form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; verified?: string }>
}) {
  const { reset, verified } = await searchParams
  return (
    <LoginForm
      resetSuccess={reset === "success"}
      justVerified={verified === "true"}
    />
  )
}
