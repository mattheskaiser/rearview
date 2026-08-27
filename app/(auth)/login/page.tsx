import { AuthCard } from "@/app/components/molecules/AuthCard.molecule";
import { LoginForm } from "@/app/components/organisms/LoginForm.organism";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · Rearview" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      subtitle="Rearview is private. Sign in to reach your journal."
      footer={{
        prompt: "First time here?",
        href: "/register",
        linkLabel: "Create your account",
      }}
    >
      <LoginForm />
    </AuthCard>
  );
}
