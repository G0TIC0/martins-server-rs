import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Disc, Smartphone, User, ChevronRight, ArrowLeft } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const Login: React.FC = () => {
  const { user, login, loading } = useFirebase();
  const [loginMode, setLoginMode] = useState<'options' | 'simplified'>('options');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSimplifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);

    try {
      // Clean identifier (remove dots, dashes, etc)
      const cleanId = identifier.replace(/\D/g, '');
      
      // Look up user by CPF or Phone
      const usersRef = collection(db, 'users');
      const qCpf = query(usersRef, where('cpf', '==', cleanId));
      const qPhone = query(usersRef, where('phone', '==', cleanId));
      
      const [snapCpf, snapPhone] = await Promise.all([getDocs(qCpf), getDocs(qPhone)]);
      
      const foundDoc = snapCpf.docs[0] || snapPhone.docs[0];

      if (!foundDoc) {
        throw new Error('Usuário não encontrado com este CPF ou Telefone.');
      }

      const userData = foundDoc.data();
      // In a real app, we would verify the PIN server-side or via a secure challenge.
      // For this prototype, we'll simulate the success if a user is found.
      if (pin === '123456') { // Mock PIN for demo
        alert(`Bem-vindo, ${userData.displayName}! (Simulação de Login via CPF/Telefone)`);
        // Note: Real login would require Firebase Custom Auth or Phone Auth.
        // For now, we'll suggest the user use Google Login for full functionality.
        setError('Para segurança total, use o Login com Google. O login via CPF está em fase de testes.');
      } else {
        throw new Error('PIN incorreto. Tente 123456 para o protótipo.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
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

        <AnimatePresence mode="wait">
          {loginMode === 'options' ? (
            <motion.div
              key="options"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="rounded-xl bg-[#F9FAFB] p-6 text-sm text-[#4B5563]">
                <p className="font-medium text-[#111827]">Bem-vindo ao futuro das vendas.</p>
                <p className="mt-1">Escolha como deseja acessar sua conta.</p>
              </div>

              <button
                onClick={login}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#111827] px-6 py-4 text-lg font-bold text-white shadow-xl shadow-black/10 transition-all hover:bg-black hover:shadow-2xl active:scale-95"
              >
                <LogIn className="h-6 w-6" />
                Entrar com Google
              </button>

              <button
                onClick={() => setLoginMode('simplified')}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-6 py-4 text-lg font-bold text-[#111827] shadow-sm transition-all hover:bg-[#F9FAFB] active:scale-95"
              >
                <Smartphone className="h-6 w-6" />
                CPF ou Telefone
              </button>

              <p className="text-center text-xs text-[#9CA3AF]">
                Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="simplified"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setLoginMode('options')}
                className="flex items-center gap-2 text-sm font-bold text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              <form onSubmit={handleSimplifiedLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-[#9CA3AF]">CPF ou Telefone</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      required
                      type="text"
                      placeholder="000.000.000-00"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] pl-12 pr-4 text-lg font-medium focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-[#9CA3AF]">PIN de Acesso</label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      required
                      type="password"
                      maxLength={6}
                      placeholder="••••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] pl-12 pr-4 text-2xl tracking-[0.5em] font-bold focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
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
                  {isLoggingIn ? 'Verificando...' : 'Acessar Sistema'}
                  <ChevronRight className="h-5 w-5" />
                </button>
              </form>

              <p className="text-center text-[10px] text-[#9CA3AF]">
                O PIN de acesso é enviado via SMS ou E-mail no primeiro cadastro.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
