import React, { useState } from "react";
import { motion } from "motion/react";
import { Lock, User, Eye, EyeOff, AlertCircle, FileSpreadsheet, Building2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client lazily
let supabase: any = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dormcqnqebcvollbnkwg.supabase.co";
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcm1jcW5xZWJjdm9sbGJua3dnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjkzMTUzNCwiZXhwIjoyMTAyNTA3NTM0fQ.bOQWKQYWx0Ct_KcNb98pVdGDoqssFCBu3q005uia2Rw";
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

interface LoginScreenProps {
  onLoginSuccess: (username: string, name: string, role: string, formato: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = String(password).trim();

    if (!cleanUser) {
      setError("Por favor, ingrese su usuario.");
      return;
    }
    if (!cleanPass) {
      setError("Por favor, ingrese su contraseña.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await getSupabase()
        .from("usuarios")
        .select("*")
        .eq("user_email", cleanUser)
        .eq("password", cleanPass)
        .maybeSingle();

      if (error || !data) {
        setError("Usuario o contraseña incorrectos.");
      } else {
        onLoginSuccess(data.user_email, data.nombre_completo || data.user_email, data.cargo || "AUDITO", data.formato || "MASS");
      }
    } catch (err) {
      console.error(err);
      setError("Error al conectar con el servidor de autenticación.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(255,255,255,0))]" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Branding Title */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center bg-emerald-500/10 text-emerald-400 p-4 rounded-3xl border border-emerald-500/20 shadow-inner">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
              SÁBANA DE INVESTIGACIÓN
            </h2>
            <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-1">
              Plataforma Control Tower • SPSA
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Iniciar Sesión</h3>
            <p className="text-xs text-slate-400">
              Ingrese sus credenciales corporativas autorizadas para acceder.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3 text-rose-200 text-xs leading-normal"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Usuario / Correo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="ejemplo@spsa.pe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium disabled:opacity-50"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3.5 pl-11 pr-11 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3.5 px-4 rounded-2xl transition-all shadow-[0_4px_20px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Verificando...</span>
                </>
              ) : (
                <span>Ingresar al Sistema</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-8 flex items-center justify-center gap-2">
          <Building2 className="w-3.5 h-3.5" /> Supermercados Peruanos S.A. © 2026
        </p>
      </motion.div>
    </div>
  );
}
