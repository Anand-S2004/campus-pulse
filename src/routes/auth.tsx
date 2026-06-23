// /auth — sign-in / sign-up / forgot-password / reset-password screen.
// College email only. Signup hits the public API which enforces the domain server-side.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isCollegeEmail, COLLEGE_EMAIL_DOMAIN } from "@/lib/college";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Mode = "signin" | "signup" | "forgot" | "reset";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · Campus Pulse" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Detect Supabase recovery link (arrives as URL hash: #type=recovery&access_token=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setMode("reset");
    }
  }, []);

  function resetState() {
    setError(null);
    setSuccess(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    resetState();

    setBusy(true);
    try {
      if (mode === "forgot") {
        if (!email) throw new Error("Enter your college email.");
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (resetErr) throw resetErr;
        setSuccess(`Reset link sent to ${email}. Check your inbox.`);
        toast.success("Password reset email sent");
        setBusy(false);
        return;
      }

      if (mode === "reset") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const { error: updateErr } = await supabase.auth.updateUser({ password });
        if (updateErr) throw updateErr;
        setSuccess("Password updated! Redirecting…");
        toast.success("Password updated successfully");
        setTimeout(() => nav({ to: "/" }), 1000);
        setBusy(false);
        return;
      }

      // signin / signup
      if (!isCollegeEmail(email)) {
        throw new Error(`Please use your @${COLLEGE_EMAIL_DOMAIN} college email.`);
      }
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");

      if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter a display name.");
        const res = await fetch("/api/public/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, display_name: name }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? `Signup failed (${res.status})`);
        setSuccess("Account created! Signing you in…");
        toast.success("Account created successfully");
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        if (signInErr.message.toLowerCase().includes("invalid")) {
          throw new Error(
            mode === "signin"
              ? "Email or password is incorrect. If you haven't signed up yet, click 'Sign up' below."
              : signInErr.message,
          );
        }
        throw signInErr;
      }

      setSuccess("Signed in! Redirecting…");
      toast.success(`Welcome${name ? `, ${name}` : ""}!`);
      setTimeout(() => nav({ to: "/" }), 400);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    signin: "Sign in",
    signup: "Create account",
    forgot: "Reset password",
    reset: "Set new password",
  };

  const descriptions: Record<Mode, string> = {
    signin: `Sign in with your @${COLLEGE_EMAIL_DOMAIN} email.`,
    signup: `Create an account (@${COLLEGE_EMAIL_DOMAIN} only).`,
    forgot: "We'll email you a link to reset your password.",
    reset: "Enter your new password below.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Campus Pulse</CardTitle>
          <CardDescription>{descriptions[mode]}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-500/50 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Anu Sharma"
                  required
                />
              </div>
            )}

            {(mode === "signin" || mode === "signup" || mode === "forgot") && (
              <div className="space-y-2">
                <Label htmlFor="email">College email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={`name@${COLLEGE_EMAIL_DOMAIN}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            {(mode === "signin" || mode === "signup" || mode === "reset") && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  {mode === "reset" ? "New password" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            )}

            {mode === "reset" && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "signin" && "Signing in…"}
                  {mode === "signup" && "Creating account…"}
                  {mode === "forgot" && "Sending link…"}
                  {mode === "reset" && "Updating password…"}
                </>
              ) : (
                titles[mode]
              )}
            </Button>

            {/* Navigation links */}
            <div className="space-y-1 text-center text-sm text-muted-foreground">
              {mode === "signin" && (
                <>
                  <button
                    type="button"
                    className="block w-full hover:text-foreground hover:underline"
                    onClick={() => { setMode("signup"); resetState(); }}
                  >
                    Don't have an account? Sign up →
                  </button>
                  <button
                    type="button"
                    className="block w-full hover:text-foreground hover:underline"
                    onClick={() => { setMode("forgot"); resetState(); }}
                  >
                    Forgot password?
                  </button>
                </>
              )}
              {mode === "signup" && (
                <button
                  type="button"
                  className="block w-full hover:text-foreground hover:underline"
                  onClick={() => { setMode("signin"); resetState(); }}
                >
                  ← Already have an account? Sign in
                </button>
              )}
              {mode === "forgot" && (
                <button
                  type="button"
                  className="block w-full hover:text-foreground hover:underline"
                  onClick={() => { setMode("signin"); resetState(); }}
                >
                  ← Back to sign in
                </button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
