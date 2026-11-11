import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { type AuthUser, authProvider, demoAccounts, type Role } from "./auth";

const roleDetails: Record<
  Role,
  { label: string; description: string; icon: typeof GraduationCap }
> = {
  student: {
    label: "Student",
    description: "Shop and track orders",
    icon: GraduationCap,
  },
  staff: {
    label: "Staff",
    description: "Process campus sales",
    icon: Store,
  },
  admin: {
    label: "Administrator",
    description: "Manage the center",
    icon: ShieldCheck,
  },
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
      setError(reason instanceof Error ? reason.message : "We couldn’t complete your request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#edf0e8] p-3 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -right-32 -top-40 size-[620px] rounded-full bg-[#d3dfd2]/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-52 -left-32 size-[620px] rounded-full bg-[#e4dcc8]/70 blur-3xl" />

      <div className="animate-enter relative mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1240px] overflow-hidden rounded-[28px] border border-white/80 bg-[#fbfcf8] shadow-[0_30px_100px_rgba(27,61,45,.14)] sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-[#123d2c] p-12 text-white lg:flex lg:flex-col xl:p-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,255,255,.15),transparent_30%),linear-gradient(145deg,transparent_42%,rgba(163,184,146,.2))]" />
          <div className="absolute -bottom-24 -right-24 size-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-12 -right-12 size-56 rounded-full border border-white/10" />

          <div className="relative flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-full bg-white p-1.5 shadow-lg">
              <img
                src="/assets/plmun-logo.png"
                alt="PLMun seal"
                className="size-full object-contain"
              />
            </div>
            <div className="text-sm font-bold tracking-[.13em]">PLMUN BUSINESS CENTER</div>
          </div>

          <div className="relative my-auto max-w-xl">
            <h1 className="text-5xl font-semibold leading-[1.06] tracking-[-.05em] xl:text-6xl">
              Your campus essentials, one sign-in away.
            </h1>
            <p className="mt-7 max-w-lg text-sm leading-7 text-white/65">
              Order school supplies, request document services, and manage Business Center
              operations through one secure workspace.
            </p>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {["Student orders", "Counter sales", "Live inventory"].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-white/6 px-3 py-4 text-[10px] font-medium text-white/75 backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <p className="relative text-[10px] tracking-wide text-white/40">
            Pamantasan ng Lungsod ng Muntinlupa
          </p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-[450px]">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <img
                src="/assets/plmun-logo.png"
                alt="PLMun seal"
                className="size-14 object-contain"
              />
              <div className="text-xs font-bold tracking-[.1em] text-[#163e30]">
                PLMUN BUSINESS CENTER
              </div>
            </div>

            <div className="flex rounded-lg bg-[#e9ece4] p-1">
              {(["login", "register"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setError("");
                  }}
                  className={`flex-1 rounded-md px-3 py-2.5 text-[11px] font-semibold capitalize transition-all duration-300 ${mode === item ? "bg-white text-[#184d37] shadow-sm" : "text-[#748078] hover:text-[#345547]"}`}
                >
                  {item === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>

            <h2 className="mt-7 text-3xl font-semibold tracking-[-.04em] text-[#173d2f]">
              {mode === "login" ? "Welcome back" : "Create your student account"}
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#7a847d]">
              {mode === "login"
                ? "Enter your account details to continue."
                : "Register once to order and track campus pickup."}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode === "register" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field">
                    Full name
                    <div className="input-with-icon">
                      <UserRound size={15} />
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your full name"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </label>
                  <label className="field">
                    Student ID
                    <div className="input-with-icon">
                      <GraduationCap size={15} />
                      <input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder="24174622"
                        required
                      />
                    </div>
                  </label>
                </div>
              )}
              <label className="field">
                Email address
                <div className="input-with-icon">
                  <Mail size={15} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name_course@plmun.edu.ph"
                    autoComplete="username"
                    required
                  />
                </div>
              </label>
              <label className="field">
                Password
                <div className="input-with-icon">
                  <LockKeyhole size={15} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="current-password"
                    className="pr-12!"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718079] hover:text-[#184d37]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg border border-[#dfc6bd] bg-[#fbefeb] px-3.5 py-3 text-xs leading-5 text-[#8b4333]"
                >
                  {error}
                </div>
              )}
              <button
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[#184d37] px-4 py-3.5 text-xs font-semibold text-white shadow-[0_8px_22px_rgba(24,77,55,.18)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#103d2b] hover:shadow-[0_12px_28px_rgba(24,77,55,.24)] disabled:cursor-wait disabled:opacity-65"
              >
                {loading
                  ? mode === "login"
                    ? "Signing in…"
                    : "Creating account…"
                  : mode === "login"
                    ? "Sign in securely"
                    : "Create student account"}
                {!loading && (
                  <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                )}
              </button>
            </form>

            {mode === "login" && (
              <div className="animate-enter">
                <div className="my-6 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[.14em] text-[#9aa198]">
                  <span className="h-px flex-1 bg-[#dde1d8]" /> Quick demo access
                  <span className="h-px flex-1 bg-[#dde1d8]" />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(roleDetails) as Role[]).map((role) => {
                    const detail = roleDetails[role];
                    const Icon = detail.icon;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => selectAccount(role)}
                        className="group rounded-lg border border-[#dce1d7] bg-white p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#769180] hover:shadow-md"
                      >
                        <Icon
                          size={17}
                          className="mb-2 text-[#668071] transition group-hover:text-[#184d37]"
                        />
                        <div className="text-[11px] font-semibold text-[#244838]">
                          {detail.label}
                        </div>
                        <div className="mt-1 text-[9px] leading-4 text-[#899189]">
                          {detail.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-center text-[10px] text-[#929991]">
                  Choose a role, then select “Sign in securely.”
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
