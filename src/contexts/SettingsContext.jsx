import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const SettingsContext = createContext(null);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    const [shopSettings, setShopSettings] = useState({
        name: 'My Shop',
        address: '',
        phone: '',
        taxId: '',
        promptPayId: '0107536000315',
        ttsVoice: null
    });

    const [backupLoading, setBackupLoading] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .eq('id', 'global')
                .single();
            
            if (error && error.code === 'PGRST116') {
                // Initialize default settings if not exists
                const defaultSettings = { id: 'global', ...shopSettings };
                await supabase.from('settings').insert(defaultSettings);
            } else if (data) {
                setShopSettings(data);
            }
        };
        fetchSettings();
    }, []);

    const updateShopSettings = async (newSettings) => {
        const updated = { ...shopSettings, ...newSettings };
        setShopSettings(updated);
        const { error } = await supabase
            .from('settings')
            .upsert({ id: 'global', ...updated });
        if (error) console.error("Error updating settings:", error);
    };

    const clearAllData = async () => {
        if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
            await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('shifts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            window.location.reload();
        }
    };

    const createBackup = async () => {
        try {
            setBackupLoading(true);

            const { data: products } = await supabase.from('products').select('*');
            const { data: shifts } = await supabase.from('shifts').select('*');
            const { data: customers } = await supabase.from('customers').select('*');
            const { data: settings } = await supabase.from('settings').select('*');

            const backupData = {
                version: 3,
                timestamp: new Date().toISOString(),
                tables: {
                    products,
                    shifts,
                    customers,
                    settings
                }
            };

            const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `minimart_backup_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();

            setBackupLoading(false);
        } catch (error) {
            console.error("Backup failed", error);
            alert("Backup failed: " + error.message);
            setBackupLoading(false);
        }
    };

    const restoreBackup = (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!window.confirm(`กู้คืนข้อมูลจากวันที่ ${new Date(data.timestamp).toLocaleString('th-TH')}? ทุกอย่างจะถูกทับ`)) return;

                if (data.tables) {
                    if (data.tables.products) await supabase.from('products').upsert(data.tables.products);
                    if (data.tables.shifts) await supabase.from('shifts').upsert(data.tables.shifts);
                    if (data.tables.customers) await supabase.from('customers').upsert(data.tables.customers);
                    if (data.tables.settings) await supabase.from('settings').upsert(data.tables.settings);
                }

                alert('กู้คืนข้อมูลสำเร็จ');
                window.location.reload();
            } catch (error) {
                console.error("Restore failed", error);
                alert('Restore error: ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    const value = {
        shopSettings,
        updateShopSettings,
        clearAllData,
        createBackup,
        restoreBackup,
        backupLoading
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
