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
    const [error, setError] = useState(null);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (loading) {
                console.error("Auth Timeout: Supabase did not respond in time.");
                setError("การเชื่อมต่อกับฐานข้อมูลล่าช้า กรุณาตรวจสอบอินเทอร์เน็ตหรือค่าตัวแทน (Env Vars)");
                setLoading(false);
            }
        }, 8000); // 8 second timeout

        // Initial Session Check
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                clearTimeout(timeout);
                if (session) {
                    fetchProfile(session.user);
                } else {
                    setLoading(false);
                }
            })
            .catch(err => {
                clearTimeout(timeout);
                console.error("Session check error:", err);
                setError("ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้: " + err.message);
                setLoading(false);
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

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (supabaseUser) => {
        try {
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', supabaseUser.id)
                .single();

            if (fetchError && fetchError.code === 'PGRST116') {
                // No profile: Create default
                const ownerEmails = ['qwaser9801@gmail.com'];
                const isOwner = ownerEmails.includes(supabaseUser.email?.toLowerCase());
                const newProfile = {
                    id: supabaseUser.id,
                    username: supabaseUser.email.split('@')[0],
                    name: isOwner ? 'เจ้าของร้าน' : (supabaseUser.user_metadata?.full_name || 'New User'),
                    role: isOwner ? 'owner' : 'cashier',
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
        error,
        login,
        logout,
        isOwner: user?.role === 'owner',
        isCashier: user?.role === 'cashier',
        isAuthenticated: !!user
    };

    if (error) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                padding: '2rem',
                textAlign: 'center'
            }}>
                <h2 style={{ color: '#ef4444' }}>การเชื่อมต่อผิดพลาด</h2>
                <p style={{ color: '#6b7280', margin: '1rem 0' }}>{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    ลองอีกครั้ง (Retry)
                </button>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    gap: '1rem'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.9 }}>กำลังเชื่อมต่อระบบ...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};
