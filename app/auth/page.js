"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  User,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const floatingCharacters = [
  {
    name: "Luna",
    emoji: "🧙",
    quote: "Ask me anything magical",
  },
  {
    name: "Rex",
    emoji: "🕵️",
    quote: "I solve the unsolvable",
  },
  {
    name: "Nova",
    emoji: "🚀",
    quote: "The universe is our playground",
  },
  {
    name: "Mira",
    emoji: "🎭",
    quote: "Every story needs a bold twist",
  },
];

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPasswordStrength(password) {
  if (!password) {
    return { score: 0, label: "", color: "bg-white/10" };
  }

  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { score: 1, label: "Weak", color: "bg-red-500" };
  }

  if (score <= 3) {
    return { score: 2, label: "Medium", color: "bg-amber-400" };
  }

  return { score: 3, label: "Strong", color: "bg-emerald-500" };
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [signinData, setSigninData] = useState({
    email: "",
    password: "",
  });

  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreed: false,
  });

  const signinErrors = useMemo(() => {
    const errors = {};

    if (!signinData.email.trim()) {
      errors.email = "Email is required.";
    } else if (!isValidEmail(signinData.email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!signinData.password.trim()) {
      errors.password = "Password is required.";
    } else if (signinData.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    return errors;
  }, [signinData]);

  const signupErrors = useMemo(() => {
    const errors = {};

    if (!signupData.username.trim()) {
      errors.username = "Username is required.";
    }

    if (!signupData.email.trim()) {
      errors.email = "Email is required.";
    } else if (!isValidEmail(signupData.email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!signupData.password.trim()) {
      errors.password = "Password is required.";
    } else if (signupData.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (!signupData.confirmPassword.trim()) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (signupData.confirmPassword !== signupData.password) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (!signupData.agreed) {
      errors.agreed = "You must agree to the Terms of Service and Privacy Policy.";
    }

    return errors;
  }, [signupData]);

  const passwordStrength = useMemo(
    () => getPasswordStrength(signupData.password),
    [signupData.password]
  );

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.replace("/dashboard");
      }
    }

    checkSession();
  }, [router]);

  useEffect(() => {
    const callbackError = searchParams.get("error");

    if (callbackError) {
      setBannerError("Invalid email or password. Please try again.");
    }
  }, [searchParams]);

  function resetStatus() {
    setBannerError("");
    setSuccessMessage("");
  }

  function isSigninFieldValid(field) {
    const value = signinData[field];

    if (!value) {
      return false;
    }

    if (field === "email") {
      return isValidEmail(value);
    }

    if (field === "password") {
      return value.length >= 8;
    }

    return false;
  }

  function isSignupFieldValid(field) {
    const value = signupData[field];

    if (field === "agreed") {
      return signupData.agreed;
    }

    if (!value) {
      return false;
    }

    if (field === "email") {
      return isValidEmail(value);
    }

    if (field === "password") {
      return value.length >= 8;
    }

    if (field === "confirmPassword") {
      return value === signupData.password && signupData.password.length >= 8;
    }

    return true;
  }

  async function handleSignIn() {
    resetStatus();

    if (Object.keys(signinErrors).length > 0) {
      setBannerError("Invalid email or password. Please try again.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signinData.email,
        password: signinData.password,
      });

      if (error) {
        throw error;
      }

      router.replace("/");
    } catch {
      setBannerError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    resetStatus();

    if (Object.keys(signupErrors).length > 0) {
      setBannerError("Please fix the highlighted fields and try again.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            username: signupData.username,
          },
        },
      });

      if (error) {
        throw error;
      }

      setSuccessMessage("Account created! Check your email to verify.");
      setTab("signin");
    } catch {
      setBannerError("Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    resetStatus();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch {
      setBannerError("Google sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  function FieldIcon({ children }) {
    return (
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {children}
      </span>
    );
  }

  function ValidMark({ show }) {
    if (!show) {
      return null;
    }

    return (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-400">✓</span>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-5">
        <section className="auth-left-panel relative flex items-center justify-center px-4 py-10 sm:px-6 lg:col-span-2 lg:px-10">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="btn-interactive absolute left-4 top-4 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:text-white sm:left-6 sm:top-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </button>

          <div className="auth-card w-full max-w-md rounded-2xl border border-[#8b5cf6]/35 bg-[#11111a]/95 p-6 sm:p-7">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-5 w-5 text-[#8b5cf6]" />
                <span className="bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] bg-clip-text text-transparent">
                  CharacterChat
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-400">Your AI companions await</p>
            </div>

            <div className="mt-6 rounded-full border border-white/10 bg-white/5 p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setTab("signin");
                    resetStatus();
                  }}
                  className={`btn-interactive rounded-full px-4 py-2 text-sm font-medium ${
                    tab === "signin"
                      ? "bg-[#8b5cf6] text-white shadow-[0_6px_20px_rgba(139,92,246,0.4)]"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setTab("signup");
                    resetStatus();
                  }}
                  className={`btn-interactive rounded-full px-4 py-2 text-sm font-medium ${
                    tab === "signup"
                      ? "bg-[#8b5cf6] text-white shadow-[0_6px_20px_rgba(139,92,246,0.4)]"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {bannerError ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {bannerError}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {successMessage}
              </div>
            ) : null}

            <div className="relative mt-5 min-h-[420px] overflow-hidden">
              <div
                className={`tab-panel transition-all duration-300 ${
                  tab === "signin"
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none absolute inset-0 -translate-x-4 opacity-0"
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-400">Email</label>
                    <div className={`relative ${signinErrors.email && signinData.email ? "field-shake" : ""}`}>
                      <FieldIcon>
                        <Mail className="h-4 w-4" />
                      </FieldIcon>
                      <input
                        type="email"
                        value={signinData.email}
                        disabled={loading}
                        onChange={(event) => {
                          resetStatus();
                          setSigninData((prev) => ({ ...prev, email: event.target.value }));
                        }}
                        className="w-full rounded-xl border border-white/10 bg-[#181827] py-2.5 pl-10 pr-10 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/35 disabled:opacity-60"
                        placeholder="you@example.com"
                      />
                      <ValidMark show={isSigninFieldValid("email")} />
                    </div>
                    {signinErrors.email && signinData.email ? (
                      <p className="mt-1 text-xs text-red-400">{signinErrors.email}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-gray-400">Password</label>
                    <div className={`relative ${signinErrors.password && signinData.password ? "field-shake" : ""}`}>
                      <FieldIcon>
                        <Lock className="h-4 w-4" />
                      </FieldIcon>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={signinData.password}
                        disabled={loading}
                        onChange={(event) => {
                          resetStatus();
                          setSigninData((prev) => ({ ...prev, password: event.target.value }));
                        }}
                        className="w-full rounded-xl border border-white/10 bg-[#181827] py-2.5 pl-10 pr-16 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/35 disabled:opacity-60"
                        placeholder="Enter password"
                      />
                      <ValidMark show={isSigninFieldValid("password")} />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="btn-interactive absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-white"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {signinErrors.password && signinData.password ? (
                      <p className="mt-1 text-xs text-red-400">{signinErrors.password}</p>
                    ) : null}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={loading}
                      className="btn-interactive text-sm text-[#8b5cf6] hover:text-[#a78bfa]"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={loading}
                    className="btn-interactive flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-sm font-semibold text-white hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
                  <span className="h-px flex-1 bg-white/10" />
                  or continue with
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="btn-interactive flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#3c4043] hover:bg-[#f8f9fa] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path
                      d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8436 2.0782-1.8 2.7155v2.2582h2.9091c1.7018-1.5664 2.6873-3.8727 2.6873-6.6146z"
                      fill="#4285F4"
                    />
                    <path
                      d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9091-2.2582c-.8059.54-1.8368.8591-3.0473.8591-2.3432 0-4.3282-1.5827-5.0364-3.7091H.9545v2.3291C2.4355 15.9836 5.4818 18 9 18z"
                      fill="#34A853"
                    />
                    <path
                      d="M3.9636 10.7109C3.7832 10.1709 3.6818 9.5945 3.6818 9s.1014-1.1709.2818-1.7109V4.96H.9545A8.9983 8.9983 0 000 9c0 1.4527.3482 2.8282.9545 4.04l3.0091-2.3291z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M9 3.5795c1.3214 0 2.5082.4541 3.4418 1.3459l2.5818-2.5818C13.4636.8918 11.4264 0 9 0 5.4818 0 2.4355 2.0164.9545 4.96l3.0091 2.3291C4.6718 5.1623 6.6568 3.5795 9 3.5795z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>

                <p className="mt-5 text-center text-sm text-gray-400">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signup")}
                    disabled={loading}
                    className="btn-interactive font-medium text-[#8b5cf6] hover:text-[#a78bfa]"
                  >
                    Sign Up
                  </button>
                </p>
              </div>

              <div
                className={`tab-panel transition-all duration-300 ${
                  tab === "signup"
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none absolute inset-0 translate-x-4 opacity-0"
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-400">Username</label>
                    <div className={`relative ${signupErrors.username && signupData.username ? "field-shake" : ""}`}>
                      <FieldIcon>
                        <User className="h-4 w-4" />
                      </FieldIcon>
                      <input
                        type="text"
                        value={signupData.username}
                        disabled={loading}
                        onChange={(event) => {
                          resetStatus();
                          setSignupData((prev) => ({ ...prev, username: event.target.value }));
                        }}
                        className="w-full rounded-xl border border-white/10 bg-[#181827] py-2.5 pl-10 pr-10 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/35 disabled:opacity-60"
                        placeholder="yourname"
                      />
                      <ValidMark show={isSignupFieldValid("username")} />
                    </div>
                    {signupErrors.username && signupData.username ? (
                      <p className="mt-1 text-xs text-red-400">{signupErrors.username}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-gray-400">Email</label>
                    <div className={`relative ${signupErrors.email && signupData.email ? "field-shake" : ""}`}>
                      <FieldIcon>
                        <Mail className="h-4 w-4" />
                      </FieldIcon>
                      <input
                        type="email"
                        value={signupData.email}
                        disabled={loading}
                        onChange={(event) => {
                          resetStatus();
                          setSignupData((prev) => ({ ...prev, email: event.target.value }));
                        }}
                        className="w-full rounded-xl border border-white/10 bg-[#181827] py-2.5 pl-10 pr-10 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/35 disabled:opacity-60"
                        placeholder="you@example.com"
                      />
                      <ValidMark show={isSignupFieldValid("email")} />
                    </div>
                    {signupErrors.email && signupData.email ? (
                      <p className="mt-1 text-xs text-red-400">{signupErrors.email}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-gray-400">Password</label>
                    <div className={`relative ${signupErrors.password && signupData.password ? "field-shake" : ""}`}>
                      <FieldIcon>
                        <Lock className="h-4 w-4" />
                      </FieldIcon>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={signupData.password}
                        disabled={loading}
                        onChange={(event) => {
                          resetStatus();
                          setSignupData((prev) => ({ ...prev, password: event.target.value }));
                        }}
                        className="w-full rounded-xl border border-white/10 bg-[#181827] py-2.5 pl-10 pr-16 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/35 disabled:opacity-60"
                        placeholder="Minimum 8 characters"
                      />
                      <ValidMark show={isSignupFieldValid("password")} />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="btn-interactive absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-white"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {signupErrors.password && signupData.password ? (
                      <p className="mt-1 text-xs text-red-400">{signupErrors.password}</p>
                    ) : null}

                    <div className="mt-2">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Password strength</span>
                        <span>{passwordStrength.label || "-"}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full ${passwordStrength.color} transition-all duration-300`}
                          style={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-gray-400">Confirm Password</label>
                    <div className={`relative ${signupErrors.confirmPassword && signupData.confirmPassword ? "field-shake" : ""}`}>
                      <FieldIcon>
                        <Lock className="h-4 w-4" />
                      </FieldIcon>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={signupData.confirmPassword}
                        disabled={loading}
                        onChange={(event) => {
                          resetStatus();
                          setSignupData((prev) => ({ ...prev, confirmPassword: event.target.value }));
                        }}
                        className="w-full rounded-xl border border-white/10 bg-[#181827] py-2.5 pl-10 pr-16 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/35 disabled:opacity-60"
                        placeholder="Re-enter password"
                      />
                      <ValidMark show={isSignupFieldValid("confirmPassword")} />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="btn-interactive absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-white"
                        aria-label="Toggle confirm password visibility"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {signupErrors.confirmPassword && signupData.confirmPassword ? (
                      <p className="mt-1 text-xs text-red-400">{signupErrors.confirmPassword}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="flex items-start gap-2 text-sm text-gray-400">
                      <input
                        type="checkbox"
                        checked={signupData.agreed}
                        disabled={loading}
                        onChange={(event) => {
                          resetStatus();
                          setSignupData((prev) => ({ ...prev, agreed: event.target.checked }));
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#181827] text-[#8b5cf6] focus:ring-[#8b5cf6]"
                      />
                      <span>I agree to Terms of Service and Privacy Policy</span>
                    </label>
                    {signupErrors.agreed ? <p className="mt-1 text-xs text-red-400">{signupErrors.agreed}</p> : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={loading}
                    className="btn-interactive flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-sm font-semibold text-white hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
                  <span className="h-px flex-1 bg-white/10" />
                  or continue with
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="btn-interactive flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#3c4043] hover:bg-[#f8f9fa] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path
                      d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8436 2.0782-1.8 2.7155v2.2582h2.9091c1.7018-1.5664 2.6873-3.8727 2.6873-6.6146z"
                      fill="#4285F4"
                    />
                    <path
                      d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9091-2.2582c-.8059.54-1.8368.8591-3.0473.8591-2.3432 0-4.3282-1.5827-5.0364-3.7091H.9545v2.3291C2.4355 15.9836 5.4818 18 9 18z"
                      fill="#34A853"
                    />
                    <path
                      d="M3.9636 10.7109C3.7832 10.1709 3.6818 9.5945 3.6818 9s.1014-1.1709.2818-1.7109V4.96H.9545A8.9983 8.9983 0 000 9c0 1.4527.3482 2.8282.9545 4.04l3.0091-2.3291z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M9 3.5795c1.3214 0 2.5082.4541 3.4418 1.3459l2.5818-2.5818C13.4636.8918 11.4264 0 9 0 5.4818 0 2.4355 2.0164.9545 4.96l3.0091 2.3291C4.6718 5.1623 6.6568 3.5795 9 3.5795z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>

                <p className="mt-5 text-center text-sm text-gray-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signin")}
                    disabled={loading}
                    className="btn-interactive font-medium text-[#8b5cf6] hover:text-[#a78bfa]"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#1a0533] to-[#0a0a0f] lg:col-span-3 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.2),transparent_38%)]" />

          {floatingCharacters.map((character, index) => (
            <div
              key={character.name}
              className="floating-card absolute w-56 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md"
              style={{
                top: `${18 + index * 18}%`,
                left: `${10 + (index % 2) * 46}%`,
                animationDelay: `${index * 0.7}s`,
              }}
            >
              <p className="text-lg">{character.emoji}</p>
              <p className="mt-1 text-sm font-semibold text-white">{character.name}</p>
              <p className="mt-1 text-xs text-gray-300">{character.quote}</p>
            </div>
          ))}

          <div className="relative z-10 mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-8 text-center">
            <h2 className="text-4xl font-extrabold text-white xl:text-5xl">500+ AI Characters</h2>
            <p className="mt-3 text-lg text-gray-300">Ready to chat with you right now</p>

            <div className="mt-10 space-y-3 text-left">
              <p className="flex items-center gap-2 text-gray-300">💬 Unlimited conversations</p>
              <p className="flex items-center gap-2 text-gray-300">🎭 Create your own characters</p>
              <p className="flex items-center gap-2 text-gray-300">🔒 Private &amp; secure</p>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .auth-card {
          animation: authCardEnter 420ms ease-out;
          box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.18), 0 20px 50px rgba(8, 8, 16, 0.7),
            0 0 40px rgba(139, 92, 246, 0.22);
        }

        .floating-card {
          animation: floatY 6s ease-in-out infinite;
        }

        .auth-left-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, #0a0a0f 0%, #1a0533 45%, #0f1430 75%, #0a0a0f 100%);
          background-size: 220% 220%;
          animation: panelGradientShift 14s ease-in-out infinite;
          opacity: 0.6;
          pointer-events: none;
        }

        .auth-left-panel > * {
          position: relative;
          z-index: 1;
        }

        .floating-card {
          animation: floatRotate 8s ease-in-out infinite;
          transform-origin: center;
        }

        .field-shake {
          animation: fieldShake 220ms linear;
        }

        @keyframes panelGradientShift {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes floatRotate {
          0%,
          100% {
            transform: translateY(0) rotate(-1.4deg);
          }
          50% {
            transform: translateY(-14px) rotate(1.4deg);
          }
        }

        @keyframes fieldShake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-3px);
          }
          75% {
            transform: translateX(3px);
          }
        }

        @keyframes authCardEnter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
