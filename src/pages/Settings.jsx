import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { Save, Database, Volume2 } from 'lucide-react';
import './Settings.css';

const Settings = () => {
    const { shopSettings, updateShopSettings, createBackup, restoreBackup, backupLoading } = useSettings();
    const { t } = useLanguage();
    
    const [formData, setFormData] = useState(shopSettings);
    const [isDirty, setIsDirty] = useState(false);
    const [voices, setVoices] = useState([]);

    useEffect(() => {
        const loadVoices = () => {
            const allVoices = window.speechSynthesis.getVoices();
            const thaiVoices = allVoices.filter(v => v.lang.includes('th') || v.name.includes('Thai'));
            setVoices(thaiVoices.length > 0 ? thaiVoices : allVoices);
        };

        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    useEffect(() => {
        setFormData(shopSettings);
    }, [shopSettings]);

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
                        <p className="text-xs text-muted" style={{ marginTop: '0.5rem', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: t('voiceHint') || '' }} />
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
                <h3><Database size={20} /> {t('dataManagement') || 'สำรองข้อมูล'}</h3>

                <Card padding="lg">
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h5 style={{ marginBottom: '0.2rem' }}>{t('createBackup')}</h5>
                                <p className="text-muted text-sm">{t('createBackupDesc')}</p>
                            </div>
                            <Button onClick={createBackup} icon={Save} disabled={backupLoading}>
                                {backupLoading ? t('backingUp') : t('backup')}
                            </Button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
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
                </Card>
            </div>
        </div>
    );
};

export default Settings;
