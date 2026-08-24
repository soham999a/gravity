import type { Metadata } from "next";
import AuthPage from "@/components/auth/AuthForm";


export const metadata: Metadata = { title: "Sign in — GRAVITY" };

export default function LoginPage() {
  return <AuthPage mode="login" />;
}
