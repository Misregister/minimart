import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { Trash2, Save, X } from 'lucide-react';
import './ImportPreviewModal.css';

const ImportPreviewModal = ({ isOpen, onClose, data, onConfirm }) => {
    const [editableData, setEditableData] = useState([]);

    useEffect(() => {
        if (isOpen && data) {
            // Add unique ID for local management if not present, and ensure numbers are numbers
            setEditableData(data.map((item, index) => ({
                ...item,
                _tempId: index,
                stock: Number(item.stock) || 0,
                price: Number(item.price) || 0,
                cost: Number(item.cost) || 0,
                minStock: Number(item.minStock) || 0,
                packSize: Number(item.packSize) || 1,
                packPrice: Number(item.packPrice) || 0,
                caseSize: Number(item.caseSize) || 1,
                casePrice: Number(item.casePrice) || 0
            })));
        }
    }, [isOpen, data]);

    const handleChange = (id, field, value) => {
        setEditableData(prev => prev.map(item =>
            item._tempId === id ? { ...item, [field]: value } : item
        ));
    };

    const handleDelete = (id) => {
        setEditableData(prev => prev.filter(item => item._tempId !== id));
    };

    const handleConfirm = () => {
        // Clean up temp IDs before sending back
        const finalData = editableData.map(({ _tempId, ...rest }) => rest);
        onConfirm(finalData);
    };

    if (!editableData.length) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Review Import Data"
            size="xl"
        >
            <div className="import-preview-container">
                <div className="preview-header">
                    <p>Review and edit the data below before importing. {editableData.length} items found.</p>
                </div>

                <div className="table-wrapper">
                    <table className="preview-table">
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>Status</th>
                                <th>Name</th>
                                <th style={{ width: '100px' }}>Image URL</th>
                                <th>Barcode</th>
                                <th style={{ width: '80px' }}>Stock</th>
                                <th style={{ width: '80px' }}>Unit</th>
                                <th style={{ width: '100px' }}>Price</th>
                                <th style={{ width: '100px' }}>Cost</th>
                                <th style={{ width: '120px' }}>Category</th>
                                <th style={{ width: '120px' }}>Pack Barcode</th>
                                <th style={{ width: '80px' }}>Pack Qty</th>
                                <th style={{ width: '120px' }}>Case Barcode</th>
                                <th style={{ width: '80px' }}>Case Qty</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {editableData.map((item) => (
                                <tr key={item._tempId}>
                                    <td>
                                        <span className={`status-badge ${item._status === 'Update' ? 'status-update' : 'status-new'}`}>
                                            {item._status || 'New'}
                                        </span>
                                    </td>
                                    <td>
                                        <input
                                            className="table-input"
                                            value={item.name || ''}
                                            onChange={(e) => handleChange(item._tempId, 'name', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="table-input"
                                            value={item.image || ''}
                                            placeholder="https://..."
                                            onChange={(e) => handleChange(item._tempId, 'image', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="table-input"
                                            value={item.barcode || ''}
                                            onChange={(e) => handleChange(item._tempId, 'barcode', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className="table-input"
                                            value={item.stock}
                                            onChange={(e) => handleChange(item._tempId, 'stock', Number(e.target.value))}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="table-input"
                                            value={item.unit || ''}
                                            onChange={(e) => handleChange(item._tempId, 'unit', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className="table-input"
                                            value={item.price}
                                            onChange={(e) => handleChange(item._tempId, 'price', Number(e.target.value))}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className="table-input"
                                            value={item.cost}
                                            onChange={(e) => handleChange(item._tempId, 'cost', Number(e.target.value))}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="table-input"
                                            value={item.category || ''}
                                            onChange={(e) => handleChange(item._tempId, 'category', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="table-input"
                                            value={item.packBarcode || ''}
                                            onChange={(e) => handleChange(item._tempId, 'packBarcode', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className="table-input"
                                            value={item.packSize}
                                            onChange={(e) => handleChange(item._tempId, 'packSize', Number(e.target.value))}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="table-input"
                                            value={item.caseBarcode || ''}
                                            onChange={(e) => handleChange(item._tempId, 'caseBarcode', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className="table-input"
                                            value={item.caseSize}
                                            onChange={(e) => handleChange(item._tempId, 'caseSize', Number(e.target.value))}
                                        />
                                    </td>
                                    <td>
                                        <button
                                            className="delete-row-btn"
                                            onClick={() => handleDelete(item._tempId)}
                                            title="Remove this row"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="preview-footer">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} icon={Save}>Confirm Import</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ImportPreviewModal;
