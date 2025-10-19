"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "./loginForm";
import SignupForm from "./signupForm";
import { authUtils } from "@/lib/auth";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    if (authUtils.isAuthenticated()) {
      // Redirect to dashboard page
      router.push("/dashboard");
      return;
    }
    setLoading(false);
  }, [router]);

  const handleLoginSuccess = () => {
    // Redirect to dashboard page
    router.push("/dashboard");
  };

  const handleSignupSuccess = () => {
    // Redirect to dashboard page
    router.push("/dashboard");
  };

  // If still loading, show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Show login/signup forms
  return (
    <>
      {isLogin ? (
        <LoginForm
          onSwitchToSignup={() => setIsLogin(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      ) : (
        <SignupForm
          onSwitchToLogin={() => setIsLogin(true)}
          onSignupSuccess={handleSignupSuccess}
        />
      )}
    </>
  );
}
