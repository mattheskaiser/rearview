import { EmptyState } from "@/app/components/atoms/EmptyState.atom";
import { AuthCard } from "@/app/components/molecules/AuthCard.molecule";
import { RegisterForm } from "@/app/components/organisms/RegisterForm.organism";
import { canRegister } from "@/lib/auth/registration";
import { prisma } from "@/lib/db/client";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create account · Rearview" };

export default async function RegisterPage() {
  const userCount = await prisma.user.count();
  const open = canRegister({
    userCount,
    allowRegistration: env.AUTH_ALLOW_REGISTRATION,
  });

  if (!open) {
    return (
      <AuthCard
        title="Registration is closed"
        footer={{ prompt: "Already have an account?", href: "/login", linkLabel: "Sign in" }}
      >
        <EmptyState
          title="Rearview is a private personal application"
          description="An account already exists. Set AUTH_ALLOW_REGISTRATION=true to add another."
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="This is the one account for this Rearview. Sign-up locks afterward."
      footer={{ prompt: "Already have an account?", href: "/login", linkLabel: "Sign in" }}
    >
      <RegisterForm />
    </AuthCard>
  );
}
