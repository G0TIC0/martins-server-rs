import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';

interface SupabaseContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
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

  useEffect(() => {
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const userProfile = await fetchProfile(currentUser.id);
        setProfile(userProfile);
      }
      setLoading(false);
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const userProfile = await fetchProfile(currentUser.id);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
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
      logout: handleLogout, 
      isAdmin, 
      isManager, 
      isSales, 
      isFinance, 
      isTechnician, 
      isCustomer 
    }}>
      {children}
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
