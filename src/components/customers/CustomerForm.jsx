import React, { useState, useEffect } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';
import { useCustomer } from '../../contexts/CustomerContext';
import { Save, User, Phone } from 'lucide-react';
import './CustomerForm.css';

const CustomerForm = ({ customer, onClose }) => {
    const { addCustomer, updateCustomer } = useCustomer();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        notes: ''
    });

    useEffect(() => {
        if (customer) {
            setFormData({
                name: customer.name || '',
                phone: customer.phone || '',
                notes: customer.notes || ''
            });
        }
    }, [customer]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (customer) {
                await updateCustomer(customer.id, formData);
            } else {
                await addCustomer(formData);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save customer:", error);
            alert("Failed to save customer. Please check your internet connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="customer-form" onSubmit={handleSubmit}>
            <Input
                label="Customer Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                icon={User}
                required
                autoFocus
                disabled={loading}
            />
            <Input
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                icon={Phone}
                required
                disabled={loading}
            />
            <div className="input-wrapper">
                <label className="input-label">Notes</label>
                <textarea
                    className="input-field textarea-field"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    disabled={loading}
                />
            </div>

            <div className="form-actions">
                <Button variant="outline" type="button" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button type="submit" icon={Save} isLoading={loading}>Save Customer</Button>
            </div>
        </form>
    );
};

export default CustomerForm;
