import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';

interface SupabaseContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isSales: boolean;
  isFinance: boolean;
  isTechnician: boolean;
  isCustomer: boolean;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setError('Configuração do Supabase ausente. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no painel de Segredos.');
      setLoading(false);
      return;
    }

    const fetchProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return {
        uid: data.id,
        email: data.email,
        displayName: data.display_name || '',
        photoURL: data.photo_url || '',
        role: data.role as UserRole,
        cpf: data.cpf,
        phone: data.phone,
        createdAt: data.created_at,
      } as UserProfile;
    };

    // Check active sessions and sets the user
    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setLoading(false);
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          try {
            const userProfile = await fetchProfile(currentUser.id);
            setProfile(userProfile);
          } catch (profileError) {
            console.error('Error fetching profile in initAuth:', profileError);
          }
        }
      } catch (error) {
        console.error('Critical error during Supabase initialization:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const userProfile = await fetchProfile(currentUser.id);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error during onAuthStateChange:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const role = profile?.role;
  const isAdmin = role === 'admin' || user?.email === 'mig7mor@gmail.com';
  const isManager = role === 'manager' || isAdmin;
  const isSales = role === 'sales' || isManager;
  const isFinance = role === 'finance' || isManager;
  const isTechnician = role === 'technician' || isManager;
  const isCustomer = role === 'customer';

  return (
    <SupabaseContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      error,
      logout: handleLogout, 
      isAdmin, 
      isManager, 
      isSales, 
      isFinance, 
      isTechnician, 
      isCustomer 
    }}>
      {error ? (
        <div className="flex h-screen items-center justify-center bg-red-50 p-4">
          <div className="max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
            <div className="mb-4 text-red-600 font-bold text-xl">Erro de Configuração</div>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="text-sm text-gray-400">
              Por favor, configure as variáveis de ambiente no painel de Segredos do AI Studio.
            </div>
          </div>
        </div>
      ) : children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
