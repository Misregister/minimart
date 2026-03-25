import React from 'react';
import { Outlet } from 'react-router-dom';
import Card from '../common/Card';

const AuthLayout = () => {
    return (
        <div className="flex-center" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
            <Card padding="lg" style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ color: 'var(--primary)', fontWeight: 700 }}>POS System</h1>
                </div>
                <Outlet />
            </Card>
        </div>
    );
};

export default AuthLayout;
