import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { withRetry } from '../lib/supabase-retry';
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

  const initialized = React.useRef(false);
  const fetchingProfile = React.useRef<string | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setError('Configuração do Supabase ausente. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no painel de Segredos.');
      setLoading(false);
      return;
    }

    const fetchProfile = async (userId: string) => {
      if (fetchingProfile.current === userId) {
        console.log('[SupabaseContext] Already fetching profile for:', userId);
        return profileRef.current;
      }
      
      fetchingProfile.current = userId;
      try {
        console.log('[SupabaseContext] Fetching profile for:', userId);
        const { data, error } = await withRetry(async () => 
          await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        ) as { data: any | null; error: any };

        if (error) {
          if (error.code === 'PGRST116') {
            console.warn('[SupabaseContext] Profile not found, creating default...');
            const { data: newData, error: insertError } = await withRetry(async () => 
              await supabase
                .from('profiles')
                .insert({
                  id: userId,
                  email: userRef.current?.email || '',
                  display_name: userRef.current?.user_metadata?.display_name || userRef.current?.email?.split('@')[0] || 'Usuário',
                  role: 'sales'
                })
                .select()
                .single()
            ) as { data: any | null; error: any };

            if (insertError) {
              console.error('[SupabaseContext] Error creating profile:', insertError);
              return null;
            }
            console.log('[SupabaseContext] Profile created successfully.');
            return mapProfileData(newData);
          }
          console.error('[SupabaseContext] Error fetching profile:', error);
          return null;
        }

        console.log('[SupabaseContext] Profile fetched successfully.');
        return mapProfileData(data);
      } catch (err) {
        console.error('[SupabaseContext] Unexpected error in fetchProfile:', err);
        return null;
      } finally {
        fetchingProfile.current = null;
      }
    };

    const mapProfileData = (data: any): UserProfile => {
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

    const initializeAuth = async () => {
      try {
        console.log('[SupabaseContext] Initializing auth...');
        
        // Get initial session explicitly to avoid waiting for onAuthStateChange
        const { data: { session } } = await supabase.auth.getSession();
        const initialUser = session?.user ?? null;
        
        if (initialUser) {
          console.log('[SupabaseContext] Initial session found:', initialUser.id);
          userRef.current = initialUser;
          setUser(initialUser);
          const userProfile = await fetchProfile(initialUser.id);
          profileRef.current = userProfile;
          setProfile(userProfile);
        }
        
        setLoading(false);

        // Listen for changes on auth state
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[SupabaseContext] Auth event:', event);
          const currentUser = session?.user ?? null;
          
          try {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
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
          } catch (err) {
            console.error('[SupabaseContext] Error in onAuthStateChange callback:', err);
          } finally {
            setLoading(false);
          }
        });

        return subscription;
      } catch (err) {
        console.error('[SupabaseContext] Initialization error:', err);
        setLoading(false);
        return null;
      }
    };

    let authSubscription: any = null;
    initializeAuth().then(sub => {
      authSubscription = sub;
    });

    // Safety timeout to ensure loading is cleared eventually
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[SupabaseContext] Safety timeout triggered. Current user:', userRef.current?.id, 'Profile:', !!profileRef.current);
        setLoading(false);
      }
    }, 15000);

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
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
