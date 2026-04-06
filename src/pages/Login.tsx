import React, { useState } from 'react';
import { useSupabase } from '../context/SupabaseContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, Disc, Mail, Lock, ChevronRight, PlayCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDemo } from '../context/DemoContext';

export const Login: React.FC = () => {
  const { user, loading } = useSupabase();
  const { startDemo } = useDemo();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' 
        ? 'E-mail ou senha incorretos.' 
        : err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStartDemo = () => {
    startDemo();
    navigate('/');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-martins-blue">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-white/20 bg-white/80 p-12 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#111827] text-white shadow-lg">
            <Disc className="h-12 w-12 animate-spin-slow" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-[#111827]">MARTINS</h1>
          <p className="mt-2 font-medium text-[#4B5563]">Sistema de Orçamentos</p>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-[#F9FAFB] p-6 text-sm text-[#4B5563]">
            <p className="font-medium text-[#111827]">Bem-vindo ao futuro das vendas.</p>
            <p className="mt-1">Acesse sua conta com e-mail e senha.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-[#9CA3AF]">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  required
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] pl-12 pr-4 text-lg font-medium focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-[#9CA3AF]">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] pl-12 pr-4 text-lg font-medium focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#111827] px-6 py-4 text-lg font-bold text-white shadow-xl shadow-black/10 transition-all hover:bg-black hover:shadow-2xl active:scale-95 disabled:opacity-50"
            >
              {isLoggingIn ? 'Verificando...' : 'Entrar'}
              <ChevronRight className="h-5 w-5" />
            </button>
          </form>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="mx-4 flex-shrink text-xs font-medium text-gray-400 uppercase">ou</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <button
            onClick={handleStartDemo}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-[#111827] px-6 py-3 text-base font-bold text-[#111827] transition-all hover:bg-[#111827] hover:text-white active:scale-95"
          >
            <PlayCircle className="h-5 w-5" />
            Experimentar por 30 minutos
          </button>

          <p className="text-center text-xs text-[#9CA3AF]">
            Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
