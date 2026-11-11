import { useState } from "react";
import { type AuthUser, authProvider, demoAccounts, type Role } from "./auth";

const roleDetails: Record<Role, { label: string; description: string }> = {
  student: { label: "Student", description: "Shop products and track pickup orders" },
  staff: { label: "Staff", description: "Process sales and manage incoming orders" },
  admin: { label: "Administrator", description: "Manage inventory, reports, and users" },
};

export default function Login({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectAccount = (role: Role) => {
    setMode("login");
    const account = demoAccounts.find((candidate) => candidate.role === role)!;
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      onAuthenticated(
        mode === "login"
          ? await authProvider.signIn({ email, password })
          : await authProvider.register({ name, reference, email, password }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eeefe5] p-4 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 size-[520px] rounded-full bg-[#dce3d2] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 size-[520px] rounded-full bg-[#e5dec9] blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-2xl border border-white/70 bg-[#f8f9f3] shadow-[0_28px_90px_rgba(35,58,45,.13)] sm:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-[#173f30] p-12 text-white lg:flex lg:flex-col">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_24%),linear-gradient(135deg,transparent_40%,#9cae8c_100%)]" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-white font-bold text-[#174431]">
              P
            </span>
            <div>
              <div className="text-sm font-bold tracking-[.14em]">PLMUN BC</div>
              <div className="mt-1 text-[9px] uppercase tracking-[.2em] text-white/60">
                Business Center
              </div>
            </div>
          </div>
          <div className="relative my-auto max-w-lg">
            <div className="mb-5 text-[10px] font-bold uppercase tracking-[.24em] text-[#c8d4c1]">
              One center. Every essential.
            </div>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-.045em]">
              Campus services, made simple.
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/68">
              A unified workspace for students, Business Center staff, and administrators to shop,
              serve, and manage with clarity.
            </p>
          </div>
          <p className="relative text-[10px] text-white/45">Pamantasan ng Lungsod ng Muntinlupa</p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <span className="grid size-11 place-items-center rounded-full bg-[#184d37] font-bold text-white">
                P
              </span>
              <div>
                <div className="text-sm font-bold tracking-[.14em] text-[#163e30]">PLMUN BC</div>
                <div className="mt-1 text-[9px] uppercase tracking-[.2em] text-[#7e877c]">
                  Business Center
                </div>
              </div>
            </div>
            <div className="flex rounded-md bg-[#e9ece4] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={`flex-1 rounded px-3 py-2 text-[11px] font-semibold transition ${mode === "login" ? "bg-white text-[#184d37] shadow-sm" : "text-[#748078]"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className={`flex-1 rounded px-3 py-2 text-[11px] font-semibold transition ${mode === "register" ? "bg-white text-[#184d37] shadow-sm" : "text-[#748078]"}`}
              >
                Register
              </button>
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] text-[#173d2f]">
              {mode === "login" ? "Welcome back" : "Create an account"}
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#7a847d]">
              {mode === "login"
                ? "Sign in with your PLMun Business Center account."
                : "Register a student account for shopping and order tracking."}
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === "register" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field">
                    Full name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="field">
                    Student ID
                    <input
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="2025-00000"
                      required
                    />
                  </label>
                </div>
              )}
              <label className="field">
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@plmun.edu.ph"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="field">
                Password
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="pr-16!"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#466557]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-[#dfc6bd] bg-[#fbefeb] px-3 py-2.5 text-xs text-[#8b4333]"
                >
                  {error}
                </div>
              )}
              <button
                disabled={loading}
                className="w-full rounded-md bg-[#184d37] px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#103d2b] disabled:cursor-wait disabled:opacity-65"
              >
                {loading
                  ? mode === "login"
                    ? "Signing in…"
                    : "Creating account…"
                  : mode === "login"
                    ? "Sign in"
                    : "Create student account"}
              </button>
            </form>

            {mode === "login" && (
              <>
                <div className="my-7 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[.14em] text-[#9aa198]">
                  <span className="h-px flex-1 bg-[#dde1d8]" /> Demo accounts
                  <span className="h-px flex-1 bg-[#dde1d8]" />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(roleDetails) as Role[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => selectAccount(role)}
                      className="rounded-md border border-[#dce1d7] bg-white p-3 text-left transition hover:border-[#769180] hover:bg-[#f7f9f4]"
                    >
                      <div className="text-[11px] font-semibold text-[#244838]">
                        {roleDetails[role].label}
                      </div>
                      <div className="mt-1 text-[9px] leading-4 text-[#899189]">
                        {roleDetails[role].description}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="mt-6 text-center text-[10px] leading-4 text-[#929991]">
                  Select a demo account to fill its credentials, then sign in.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
