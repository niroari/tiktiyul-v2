"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type AuthError,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const googleProvider = new GoogleAuthProvider();

function authErrorMessage(code: string): string {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "אימייל או סיסמה שגויים";
    case "auth/email-already-in-use":  return "כתובת האימייל כבר רשומה";
    case "auth/weak-password":          return "הסיסמה חלשה מדי (לפחות 6 תווים)";
    case "auth/invalid-email":          return "כתובת אימייל לא תקינה";
    case "auth/too-many-requests":      return "יותר מדי ניסיונות, נסה שוב מאוחר יותר";
    default:                            return "שגיאה, נסה שוב";
  }
}

export default function LoginPage() {
  const router   = useRouter();
  const { user, loading } = useAuth();

  const [mode, setMode]   = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in — honour pending join flow
  useEffect(() => {
    if (!loading && user) {
      const pending = sessionStorage.getItem("joinToken");
      if (pending) {
        sessionStorage.removeItem("joinToken");
        router.replace(`/join/${pending}`);
      } else {
        router.replace("/trips");
      }
    }
  }, [user, loading, router]);

  function redirectAfterLogin() {
    const pending = sessionStorage.getItem("joinToken");
    if (pending) {
      sessionStorage.removeItem("joinToken");
      router.replace(`/join/${pending}`);
    } else {
      router.replace("/trips");
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      redirectAfterLogin();
    } catch (e) {
      setError(authErrorMessage((e as AuthError).code));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail() {
    if (!email.trim() || !pass.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), pass);
      }
      redirectAfterLogin();
    } catch (e) {
      setError(authErrorMessage((e as AuthError).code));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#f6faf8] flex flex-col items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-[#1b4332] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1b4332]">תיק טיול</h1>
          <p className="text-sm text-muted-foreground">ניהול תיק טיול לבתי ספר</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            כניסה עם Google
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-white px-2">או</span></div>
          </div>

          {/* Email / Password */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>אימייל</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>סיסמה</Label>
              <Input
                type="password"
                placeholder="••••••"
                dir="ltr"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full bg-[#1b4332] hover:bg-[#1b4332]/90"
              onClick={handleEmail}
              disabled={busy || !email.trim() || !pass.trim()}
            >
              {busy ? "..." : mode === "login" ? "כניסה" : "הרשמה"}
            </Button>
          </div>

          {/* Toggle mode */}
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "אין לך חשבון עדיין? " : "יש לך חשבון? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-primary hover:underline font-medium"
            >
              {mode === "login" ? "הרשמה" : "כניסה"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
