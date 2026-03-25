import React from 'react';
import './Button.css';
import { Loader2 } from './Icons';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    isLoading = false,
    disabled,
    icon: Icon,
    ...props
}) => {
    return (
        <button
            className={`btn btn-${variant} btn-${size} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="animate-spin" size={16} />}
            {!isLoading && Icon && <Icon size={18} />}
            {children}
        </button>
    );
};

export default Button;
