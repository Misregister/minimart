import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin as MapPinIcon, Crosshair, Check, X, Navigation, Loader2 } from 'lucide-react';
import './MapPicker.css';

// Fix for default marker icon in Leaflet + React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Helper to update map view when position changes
function ChangeView({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

const MapPicker = ({ initialLocation, onConfirm, onCancel }) => {
    // Default to Bangkok if no initial location
    const defaultPos = [13.7563, 100.5018];
    const [position, setPosition] = useState(
        initialLocation ? [initialLocation.lat, initialLocation.lng] : defaultPos
    );
    const [zoom, setZoom] = useState(15);
    const [isLocating, setIsLocating] = useState(false);
    const [userLocation, setUserLocation] = useState(null);

    // Track map movement to update position and zoom
    const MapCenterUpdater = () => {
        const map = useMap();

        const onMove = useCallback(() => {
            const center = map.getCenter();
            setPosition([center.lat, center.lng]);
        }, [map]);

        const onZoom = useCallback(() => {
            setZoom(map.getZoom());
        }, [map]);

        useEffect(() => {
            map.on('move', onMove);
            map.on('zoom', onZoom);
            return () => {
                map.off('move', onMove);
                map.off('zoom', onZoom);
            };
        }, [map, onMove, onZoom]);

        return null;
    };

    // Auto-locate if no initial location OR if initial location is the default one (user previously confirmed default)
    useEffect(() => {
        const isDefault = initialLocation &&
            Math.abs(initialLocation.lat - defaultPos[0]) < 0.0001 &&
            Math.abs(initialLocation.lng - defaultPos[1]) < 0.0001;

        if (!initialLocation || isDefault) {
            setIsLocating(true);
            // Short timeout to ensure map is ready or simply to allow UI to show loading
            setTimeout(() => handleLocateMe(), 500);
        }
    }, [initialLocation]);

    const handleLocateMe = () => {
        setIsLocating(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const newPos = [pos.coords.latitude, pos.coords.longitude];
                    setPosition(newPos);
                    setUserLocation(newPos); // Save for the blue dot marker
                    setZoom(18);
                    setIsLocating(false);
                },
                (err) => {
                    console.error("Locate error", err);
                    setIsLocating(false);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            setIsLocating(false);
        }
    };

    // Custom blue dot icon for the user's actual location
    const userLocationIcon = useMemo(() => {
        return L.divIcon({
            className: 'user-location-marker',
            html: '<div class="user-pulse-dot"></div><div class="user-pulse-ring"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }, []);

    return (
        <div className="map-picker-overlay">
            <div className="map-picker-container">
                <div className="map-picker-header">
                    <h3>ปักหมุดตำแหน่งจัดส่ง</h3>
                    <button className="close-btn" onClick={onCancel}><X size={20} /></button>
                </div>

                <div className="map-wrapper">
                    <MapContainer
                        center={position}
                        zoom={zoom}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                        maxZoom={20}
                    >
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer name="Google Maps (แนะนำ)">
                                <TileLayer
                                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                                    attribution="Google Maps"
                                    maxZoom={20}
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer checked name="ดาวเทียม (ชัดมาก)">
                                <TileLayer
                                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                                    attribution="Google Maps Satellite"
                                    maxZoom={20}
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="OpenStreetMap">
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    maxZoom={19}
                                />
                            </LayersControl.BaseLayer>
                        </LayersControl>
                        <ChangeView center={position} zoom={zoom} />
                        <MapCenterUpdater />

                        {userLocation && (
                            <Marker position={userLocation} icon={userLocationIcon} zIndexOffset={100} />
                        )}
                    </MapContainer>

                    {/* Fixed Center Pin - Premium UI */}
                    <div className="center-marker-premium">
                        <div className="marker-pulse-shadow"></div>
                        <div className="marker-bounce">
                            <MapPinIcon size={56} fill="var(--primary, #FF4B2B)" color="white" strokeWidth={1.5} />
                            <div className="marker-inner-dot"></div>
                        </div>
                    </div>

                    <button className="locate-btn" onClick={handleLocateMe} title="ตำแหน่งปัจจุบัน">
                        <Navigation size={20} />
                    </button>

                    <div className="map-instructions">
                        <Crosshair size={14} /> เลื่อนแผนที่ให้หมุดอยู่ตรงจุดส่งของ
                    </div>

                    {isLocating && (
                        <div className="map-loading-overlay">
                            <Loader2 className="spinner" size={32} color="#3b82f6" />
                            <span>กำลังค้นหาตำแหน่งของคุณ...</span>
                        </div>
                    )}

                </div>

                <div className="map-picker-footer">
                    <div className="coords-display">
                        พิกัด: {position[0].toFixed(5)}, {position[1].toFixed(5)}
                    </div>
                    <button className="confirm-map-btn" onClick={() => onConfirm({ lat: position[0], lng: position[1] })}>
                        <Check size={18} /> ยืนยันตำแหน่งนี้
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MapPicker;
