import React, { useState } from 'react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { User, Lock, AlertCircle, Mail } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth(); // Get user from context to check role AFTER login success

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const from = location.state?.from?.pathname || '/dashboard';

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(''); // Clear error on change
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!formData.email || !formData.password) {
            setError('Please enter both email and password');
            return;
        }

        setIsLoading(true);
        try {
            await login(formData.email, formData.password);

            // Note: Login is async, but state update in context might lag slightly or happen via listener.
            // However, usually after awaiting login(), the auth state changes.
            // But 'user' from useAuth() might not be updated in this closure immediately.
            // We rely on the AuthContext's logic. But for redirection...
            // It's safer to just navigate to /dashboard and let the AuthLayout or ProtectedRoute handle it.
            // OR checks the role. Since we can't easily get the role *returned* from login() without refactoring simpler...
            // Let's just go to 'from' (or dashboard). The ProtectedRoute will redirect if role doesn't match?
            // Actually, let's just go to dashboard.
            navigate(from, { replace: true });

        } catch (err) {
            setError(typeof err === 'string' ? err : 'Failed to login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Welcome Back</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Sign in to continue</p>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'orange' }}>
                    (System migrated to Firebase Auth)
                </div>
            </div>

            {error && (
                <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#fee2e2',
                    color: '#ef4444',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Input
                    name="email"
                    label="Email"
                    type="email"
                    placeholder="Enter your email"
                    icon={Mail}
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                />
                <Input
                    name="password"
                    label="Password"
                    type="password"
                    placeholder="Enter your password"
                    icon={Lock}
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>

            <Button type="submit" size="lg" style={{ width: '100%' }} isLoading={isLoading}>
                Sign In
            </Button>
        </form>
    );
};

export default Login;
