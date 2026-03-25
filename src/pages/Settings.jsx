import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useProduct } from '../contexts/ProductContext';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { Save, Database, CloudUpload, Users, X, Volume2 } from 'lucide-react';
import { migrateLocalStorageToFirebase } from '../services/migration';
import './Settings.css';

const Settings = () => {
    const { shopSettings, updateShopSettings, createBackup, restoreBackup, backupLoading } = useSettings();

    const { t } = useLanguage();

    // Placeholder until we implement migration service
    const handleCustomerMigration = async () => {
        alert("Comming soon: Customer Migration");
    };

    const [formData, setFormData] = useState(shopSettings);
    const [isDirty, setIsDirty] = useState(false);
    const [voices, setVoices] = useState([]);

    React.useEffect(() => {
        const loadVoices = () => {
            const allVoices = window.speechSynthesis.getVoices();
            // Filter primarily for Thai, but if none, show all or let user pick default
            // Actually, let's show all voices that include 'th' or just all?
            // User might want to use Google Translate Thai even if lang code is weird.
            // Let's filter by 'th' or 'Thai' just to help, or show all if list is short.
            // Better: Show local thai voices + google thai.
            const thaiVoices = allVoices.filter(v => v.lang.includes('th') || v.name.includes('Thai'));
            setVoices(thaiVoices.length > 0 ? thaiVoices : allVoices);
        };

        loadVoices();

        // Voices load async in Chrome
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        updateShopSettings(formData);
        setIsDirty(false);
        alert(t('saveSuccess') || 'บันทึกสำเร็จ');
    };

    const handleMigration = async () => {
        if (!window.confirm("ยืนยันการย้ายข้อมูลไป Cloud? (ควรทำครั้งเดียว)")) return;

        try {
            const result = await migrateLocalStorageToFirebase();
            if (result.errors.length > 0) {
                alert(`ย้ายสำเร็จ ${result.count} รายการ\nมีข้อผิดพลาด ${result.errors.length} รายการ`);
            } else {
                alert(`ย้ายข้อมูลสำเร็จทั้งหมด ${result.count} รายการ!`);
            }
        } catch (error) {
            alert("เกิดข้อผิดพลาด: " + error.message);
        }
    };

    return (
        <div className="settings-container">
            <div className="page-header">
                <div>
                    <h2 className="page-title">{t('settings')}</h2>
                    <p className="text-muted">{t('settingsDesc') || 'ตั้งค่าร้านค้าและระบบ'}</p>
                </div>
            </div>



            <div className="settings-section">
                <h3><Volume2 size={20} /> {t('soundSettings') || 'ตั้งค่าเสียง'}</h3>
                <Card padding="lg">
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            {t('voiceSelection') || 'เลือกเสียงพูด (Thai TTS)'}
                        </label>
                        <select
                            className="input-field"
                            name="ttsVoice"
                            value={formData.ttsVoice || ''}
                            onChange={handleChange}
                        >
                            <option value="">{t('defaultVoice')}</option>
                            {voices.map(voice => (
                                <option key={voice.voiceURI} value={voice.voiceURI}>
                                    {voice.name} ({voice.lang})
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted" style={{ marginTop: '0.5rem', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: t('voiceHint') }} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                if ('speechSynthesis' in window) {
                                    const msg = new SpeechSynthesisUtterance('ทดสอบเสียงพูด หนึ่ง สอง สาม สี่ ห้า');
                                    msg.lang = 'th-TH';
                                    if (formData.ttsVoice) {
                                        const selectedVoice = voices.find(v => v.voiceURI === formData.ttsVoice);
                                        if (selectedVoice) msg.voice = selectedVoice;
                                    }
                                    window.speechSynthesis.speak(msg);
                                } else {
                                    alert(t('ttsNotSupported'));
                                }
                            }}
                        >
                            {t('testVoice')}
                        </Button>
                        <Button type="button" icon={Save} onClick={handleSave} disabled={!isDirty}>
                            {t('save') || 'บันทึก'}
                        </Button>
                    </div>
                </Card>
            </div>

            <div className="settings-section">
                <h3><Database size={20} /> {t('dataManagement') || 'อัพเดทข้อมูล'}</h3>

                <Card padding="lg" style={{ marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
                        <h4>{t('backupRestore') || 'สำรองและกู้คืนข้อมูล'}</h4>

                        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h5 style={{ marginBottom: '0.2rem' }}>{t('createBackup')}</h5>
                                    <p className="text-muted text-sm">{t('createBackupDesc')}</p>
                                </div>
                                <Button onClick={createBackup} icon={Save} disabled={backupLoading}>
                                    {backupLoading ? t('backingUp') : t('backup')}
                                </Button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h5 style={{ marginBottom: '0.2rem' }}>{t('restoreData')}</h5>
                                    <p className="text-muted text-sm">{t('restoreDataDesc')}</p>
                                </div>
                                <div>
                                    <input
                                        type="file"
                                        accept=".json"
                                        id="restore-file"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                restoreBackup(e.target.files[0]);
                                                e.target.value = ''; // Reset
                                            }
                                        }}
                                    />
                                    <Button variant="outline" onClick={() => document.getElementById('restore-file').click()} icon={Database}>
                                        {t('restore')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                </Card>

                <Card padding="lg" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        {/* Products Migration */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CloudUpload size={18} />
                                    {t('cloudMigration') || 'ย้ายสินค้าขึ้น Cloud'}
                                </h4>
                                <p className="text-muted text-sm">
                                    {t('cloudMigrationDesc') || 'ย้ายข้อมูลสินค้าจากเครื่องนี้ขึ้นระบบ Cloud'}
                                </p>
                            </div>
                            <Button variant="primary" onClick={handleMigration} icon={CloudUpload}>
                                {t('uploadProducts') || 'อัปโหลดสินค้า'}
                            </Button>
                        </div>

                        {/* Customer Migration */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Users size={18} />
                                    {t('customerMigration') || 'ย้ายข้อมูลลูกค้าขึ้น Cloud'}
                                </h4>
                                <p className="text-muted text-sm">
                                    {t('customerMigrationDesc') || 'ย้ายรายชื่อลูกค้าและหนี้ค้างชำระขึ้นระบบ Cloud'}
                                </p>
                            </div>
                            <Button variant="outline" onClick={handleCustomerMigration} icon={CloudUpload}>
                                {t('uploadCustomers') || 'อัปโหลดลูกค้า'}
                            </Button>
                        </div>

                    </div>
                </Card>


            </div>
        </div>
    );
};

export default Settings;
