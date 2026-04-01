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

  // Use refs to track current state for onAuthStateChange closure
  const userRef = React.useRef<User | null>(null);
  const profileRef = React.useRef<UserProfile | null>(null);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setError('Configuração do Supabase ausente. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no painel de Segredos.');
      setLoading(false);
      return;
    }

    const fetchProfile = async (userId: string) => {
      try {
        console.log('[SupabaseContext] Fetching profile for:', userId);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('[SupabaseContext] Error fetching profile:', error);
          return null;
        }

        const mappedProfile = {
          uid: data.id,
          email: data.email,
          displayName: data.display_name || '',
          photoURL: data.photo_url || '',
          role: data.role as UserRole,
          cpf: data.cpf,
          phone: data.phone,
          createdAt: data.created_at,
        } as UserProfile;

        return mappedProfile;
      } catch (err) {
        console.error('[SupabaseContext] Unexpected error in fetchProfile:', err);
        return null;
      }
    };

    const initialize = async () => {
      try {
        console.log('[SupabaseContext] Initializing auth...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[SupabaseContext] Session error:', sessionError);
        }

        const currentUser = session?.user ?? null;
        userRef.current = currentUser;
        setUser(currentUser);

        if (currentUser) {
          const userProfile = await fetchProfile(currentUser.id);
          profileRef.current = userProfile;
          setProfile(userProfile);
        } else {
          profileRef.current = null;
          setProfile(null);
        }
      } catch (err) {
        console.error('[SupabaseContext] Initialization error:', err);
      } finally {
        console.log('[SupabaseContext] Initialization complete.');
        setLoading(false);
      }
    };

    initialize();

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[SupabaseContext] Auth event:', event);
      const currentUser = session?.user ?? null;
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Only update if user ID changed or we don't have a profile yet (and we haven't tried recently)
        if (currentUser?.id !== userRef.current?.id || (!profileRef.current && currentUser)) {
          userRef.current = currentUser;
          setUser(currentUser);
          if (currentUser) {
            const userProfile = await fetchProfile(currentUser.id);
            profileRef.current = userProfile;
            setProfile(userProfile);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        userRef.current = null;
        profileRef.current = null;
        setUser(null);
        setProfile(null);
      }
      
      setLoading(false);
    });

    // Safety timeout to ensure loading is cleared
    const timeoutId = setTimeout(() => {
      console.log('[SupabaseContext] Safety timeout triggered.');
      setLoading(false);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleLogout = React.useCallback(async () => {
    console.log('[SupabaseContext] Logging out...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear state immediately
      userRef.current = null;
      profileRef.current = null;
      setUser(null);
      setProfile(null);
      
      console.log('[SupabaseContext] Logout successful.');
    } catch (err: any) {
      console.error('[SupabaseContext] Logout error:', err);
      alert(`Erro ao sair: ${err.message}`);
      
      // Fallback: clear state anyway
      userRef.current = null;
      profileRef.current = null;
      setUser(null);
      setProfile(null);
    }
  }, []);

  const value = React.useMemo(() => {
    const role = profile?.role;
    const isAdmin = role === 'admin' || user?.email === 'mig7mor@gmail.com';
    const isManager = role === 'manager' || isAdmin;
    const isSales = role === 'sales' || isManager;
    const isFinance = role === 'finance' || isManager;
    const isTechnician = role === 'technician' || isManager;
    const isCustomer = role === 'customer';

    return {
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
    };
  }, [user, profile, loading, error, handleLogout]);

  return (
    <SupabaseContext.Provider value={value}>
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
