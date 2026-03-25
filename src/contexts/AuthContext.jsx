import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                fetchProfile(session.user);
            } else {
                setLoading(false);
            }
        });

        // Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                fetchProfile(session.user);
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (supabaseUser) => {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', supabaseUser.id)
                .single();

            if (error && error.code === 'PGRST116') {
                // No profile: Create default
                const newProfile = {
                    id: supabaseUser.id,
                    username: supabaseUser.email.split('@')[0],
                    name: supabaseUser.user_metadata?.full_name || 'New User',
                    role: 'cashier',
                    createdAt: new Date().toISOString()
                };
                const { data: created } = await supabase.from('profiles').insert(newProfile).select().single();
                setUser({ ...supabaseUser, ...created });
            } else {
                setUser({ ...supabaseUser, ...profile });
            }
        } catch (err) {
            console.error("Profile fetch error:", err);
            setUser(supabaseUser);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Login Error:", error);
            let message = error.message;
            if (message.includes('Invalid login credentials')) message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            throw message;
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
        } catch (error) {
            console.error("Logout Error:", error);
        }
    };

    const value = {
        user,
        loading,
        login,
        logout,
        isOwner: user?.role === 'owner',
        isCashier: user?.role === 'cashier',
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
