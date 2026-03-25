import React, { useRef, useState, useEffect } from 'react';
import Button from './Button';
import { Camera, Upload, X, RefreshCw, Check } from './Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import './CameraCapture.css';

const resizeImage = (dataUrl, maxWidth = 800) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            if (img.width <= maxWidth && img.height <= maxWidth) {
                resolve(dataUrl);
                return;
            }
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxWidth) {
                    width *= maxWidth / height;
                    height = maxWidth;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
    });
};

const CameraCapture = ({ onCapture, initialImage }) => {
    const { t } = useLanguage();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState(null);
    const [preview, setPreview] = useState(initialImage || null);
    const [error, setError] = useState('');

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    // Sync preview with prop changes (e.g. typing URL)
    useEffect(() => {
        setPreview(initialImage);
    }, [initialImage]);

    const startCamera = async () => {
        try {
            setError('');
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Prefer back camera
            });
            setStream(mediaStream);
            setIsCameraOpen(true);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError('Could not access camera. Please allow permissions.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Set canvas dimensions with a MAX_SIZE cap
            const MAX_SIZE = 800;
            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setPreview(dataUrl);
            onCapture(dataUrl);
            stopCamera();
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const resized = await resizeImage(reader.result);
                setPreview(resized);
                onCapture(resized);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setPreview(null);
        onCapture(null);
    };

    return (
        <div className="camera-capture-container">
            {error && <div className="camera-error">{error}</div>}

            {!isCameraOpen && !preview && (
                <div className="capture-actions">
                    <Button type="button" onClick={startCamera} icon={Camera}>
                        {t('takePhoto')}
                    </Button>
                    <div className="file-upload-wrapper">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            id="image-upload"
                            hidden
                        />
                        <Button
                            type="button"
                            variant="outline"
                            icon={Upload}
                            onClick={() => document.getElementById('image-upload').click()}
                        >
                            {t('uploadImage')}
                        </Button>
                    </div>
                </div>
            )}

            {isCameraOpen && (
                <div className="camera-view">
                    <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="camera-controls">
                        <Button type="button" onClick={capturePhoto} className="capture-btn">
                            <div className="shutter-inner"></div>
                        </Button>
                        <Button type="button" variant="ghost" className="close-camera-btn" onClick={stopCamera}>
                            <X size={24} color="white" />
                        </Button>
                    </div>
                </div>
            )}

            {preview && (
                <div className="image-preview-container">
                    <img src={preview} alt="Captured" className="image-preview" />
                    <div className="preview-overlay">
                        <Button type="button" size="sm" variant="danger" icon={X} onClick={clearImage}>
                            {t('remove')}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" icon={RefreshCw} onClick={() => { clearImage(); startCamera(); }}>
                            {t('retake')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CameraCapture;
