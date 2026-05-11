import { useState } from 'react';
import { motion } from 'framer-motion';

const DEMO_VALUES = {
  name: '',
  email: '',
  password: '',
};

const FLOATING_BADGES = [
  { label: 'Focus', value: 'Deep Work' },
  { label: 'XP', value: 'Rewards' },
  { label: 'Streak', value: 'Daily' },
];

const HIGHLIGHTS = [
  { title: 'Smart journaling', text: 'Capture your day and keep momentum.' },
  { title: 'Live profile sync', text: 'Your student profile is restored instantly.' },
  { title: 'Gamified flow', text: 'Track XP, streaks, and progress in one place.' },
];

const getPasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z\d]/.test(pwd)) score++;

  const levels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];
  return {
    score: Math.min(score, 4),
    label: levels[Math.min(score, 4)],
    color: colors[Math.min(score, 4)],
  };
};

export default function LoginPage({ onSubmit, isLoading = false, error = '', isRegister = false }) {
  const [name, setName] = useState(DEMO_VALUES.name);
  const [email, setEmail] = useState(DEMO_VALUES.email);
  const [password, setPassword] = useState(DEMO_VALUES.password);
  const [passwordConfirm, setPasswordConfirm] = useState(DEMO_VALUES.password);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === passwordConfirm;

  const validateForm = () => {
    const errors = {};
    if (isRegister) {
      if (!name.trim()) errors.name = 'Name is required';
      if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
      if (password.length < 6) errors.password = 'Password must be at least 6 characters';
      if (!passwordsMatch) errors.passwordConfirm = 'Passwords do not match';
    } else {
      if (password.length < 6) errors.password = 'Password is required';
    }
    if (!email.trim()) errors.email = 'Email is required';
    return errors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password,
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8" style={{ background: '#070816' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 15% 20%, rgba(124,58,237,0.28), transparent 22%), radial-gradient(circle at 85% 15%, rgba(14,165,233,0.22), transparent 18%), radial-gradient(circle at 50% 95%, rgba(249,115,22,0.12), transparent 24%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 80%)',
        }}
      />

      <motion.div
        className="absolute left-8 top-8 hidden h-28 w-28 rounded-full bg-violet-500/20 blur-3xl sm:block"
        animate={{ y: [0, 12, 0], x: [0, 8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-8 top-24 hidden h-36 w-36 rounded-full bg-cyan-400/15 blur-3xl sm:block"
        animate={{ y: [0, -14, 0], x: [0, -10, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center justify-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.035] p-8 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)]" />

            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.45em] text-violet-300/80">Smart Uni Guide</p>
                <h1 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl" style={{ fontFamily: "'Georgia', serif" }}>
                  Turn every session into a quest.
                </h1>
              </div>
              <motion.div
                className="hidden h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/15 text-3xl sm:flex"
                animate={{ rotate: [0, 8, 0, -8, 0], y: [0, -4, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              >
                ✦
              </motion.div>
            </div>

            <p className="relative mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Sign in to restore your student profile, sync your XP, and jump back into the journaling
              journey with a polished, game-like dashboard.
            </p>

            <div className="relative mt-8 flex flex-wrap gap-3">
              {FLOATING_BADGES.map((badge, index) => (
                <motion.div
                  key={badge.label}
                  className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs text-slate-200"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.08 }}
                >
                  <span className="mr-2 uppercase tracking-[0.28em] text-slate-500">{badge.label}</span>
                  <span className="font-medium text-violet-200">{badge.value}</span>
                </motion.div>
              ))}
            </div>

            <div className="relative mt-10 grid gap-4 sm:grid-cols-3">
              {HIGHLIGHTS.map((item, index) => (
                <motion.div
                  key={item.title}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16 + index * 0.08 }}
                >
                  <div className="mb-3 h-10 w-10 rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-400/10" />
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.05] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(124,58,237,0.18),transparent_36%),linear-gradient(0deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02))]" />

            <div className="relative mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Student Access</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">{isRegister ? 'Create Account' : 'Sign In'}</h2>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Secure</p>
                <p className="mt-1 text-xs text-slate-300">Local session enabled</p>
              </div>
            </div>

            <form className="relative space-y-4" onSubmit={handleSubmit}>
              {isRegister && (
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.25em] text-slate-400">Name</span>
                  <input
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (validationErrors.name) setValidationErrors({ ...validationErrors, name: '' });
                    }}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:ring-2 bg-black/30 ${
                      validationErrors.name
                        ? 'border-rose-500/50 focus:border-rose-400/40 focus:ring-rose-500/20'
                        : 'border-white/10 focus:border-violet-400/40 focus:ring-violet-500/20'
                    }`}
                    placeholder="Enter your name"
                    autoComplete="name"
                    required
                  />
                  {validationErrors.name && <p className="mt-1.5 text-xs text-rose-400">{validationErrors.name}</p>}
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.25em] text-slate-400">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (validationErrors.email) setValidationErrors({ ...validationErrors, email: '' });
                  }}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:ring-2 bg-black/30 ${
                    validationErrors.email
                      ? 'border-rose-500/50 focus:border-rose-400/40 focus:ring-rose-500/20'
                      : 'border-white/10 focus:border-violet-400/40 focus:ring-violet-500/20'
                  }`}
                  placeholder="student@example.com"
                  autoComplete="email"
                  required
                />
                {validationErrors.email && <p className="mt-1.5 text-xs text-rose-400">{validationErrors.email}</p>}
              </label>

              <div>
                <label className="block">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">Password</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (validationErrors.password) setValidationErrors({ ...validationErrors, password: '' });
                    }}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:ring-2 bg-black/30 ${
                      validationErrors.password
                        ? 'border-rose-500/50 focus:border-rose-400/40 focus:ring-rose-500/20'
                        : 'border-white/10 focus:border-violet-400/40 focus:ring-violet-500/20'
                    }`}
                    placeholder={isRegister ? 'Create a password (min 6 chars)' : 'Enter your password'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    minLength="6"
                    required
                  />
                  {validationErrors.password && <p className="mt-1.5 text-xs text-rose-400">{validationErrors.password}</p>}
                </label>

                {isRegister && password && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Strength</span>
                      <span className={`font-medium ${passwordStrength.color.replace('bg-', 'text-')}`}>{passwordStrength.label}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {isRegister && (
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.25em] text-slate-400">Confirm Password</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(event) => {
                      setPasswordConfirm(event.target.value);
                      if (validationErrors.passwordConfirm) setValidationErrors({ ...validationErrors, passwordConfirm: '' });
                    }}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:ring-2 bg-black/30 ${
                      validationErrors.passwordConfirm
                        ? 'border-rose-500/50 focus:border-rose-400/40 focus:ring-rose-500/20'
                        : passwordsMatch && passwordConfirm
                        ? 'border-emerald-500/50 focus:border-emerald-400/40 focus:ring-emerald-500/20'
                        : 'border-white/10 focus:border-violet-400/40 focus:ring-violet-500/20'
                    }`}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                  />
                  {validationErrors.passwordConfirm && <p className="mt-1.5 text-xs text-rose-400">{validationErrors.passwordConfirm}</p>}
                  {!validationErrors.passwordConfirm && passwordsMatch && passwordConfirm && (
                    <p className="mt-1.5 text-xs text-emerald-400">✓ Passwords match</p>
                  )}
                </label>
              )}

              {error ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <motion.button
                type="submit"
                disabled={isLoading || (isRegister && !passwordsMatch)}
                className="group relative w-full overflow-hidden rounded-2xl border-0 px-4 py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5 60%, #0ea5e9)' }}
                whileHover={!isLoading && (!isRegister || passwordsMatch) ? { scale: 1.01 } : {}}
                whileTap={!isLoading && (!isRegister || passwordsMatch) ? { scale: 0.98 } : {}}
              >
                <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.2)_50%,transparent_80%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                {isLoading ? (isRegister ? 'Creating account...' : 'Signing in...') : (isRegister ? 'Create Account' : 'Sign In')}
              </motion.button>

              <p className="text-center text-xs leading-5 text-slate-500">
                Your credentials are securely hashed on the backend and stored with your profile.
              </p>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
