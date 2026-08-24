import type { Metadata } from "next";
import AuthPage from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create account — GRAVITY" };

export default function SignupPage() {
  return <AuthPage mode="signup" />;
}
