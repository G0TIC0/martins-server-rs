import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { auth, db, loginWithGoogle, logout } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';

interface FirebaseContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isSales: boolean;
  isFinance: boolean;
  isTechnician: boolean;
  isCustomer: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          // Default role for new users
          const isAdminEmail = currentUser.email === 'mig7mor@gmail.com';
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
            role: isAdminEmail ? 'admin' : 'sales',
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', currentUser.uid), {
            ...newProfile,
            createdAt: serverTimestamp(),
          });
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const role = profile?.role;
  const isAdmin = role === 'admin' || user?.email === 'mig7mor@gmail.com';
  const isManager = role === 'manager' || isAdmin;
  const isSales = role === 'sales' || isManager;
  const isFinance = role === 'finance' || isManager;
  const isTechnician = role === 'technician' || isManager;
  const isCustomer = role === 'customer';

  return (
    <FirebaseContext.Provider value={{ user, profile, loading, login, logout: handleLogout, isAdmin, isManager, isSales, isFinance, isTechnician, isCustomer }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
