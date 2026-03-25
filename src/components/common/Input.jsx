import React from 'react';
import './Input.css';

const Input = ({
    label,
    error,
    icon: Icon,
    onIconClick,
    className = '',
    wrapperClassName = '',
    ...props
}) => {
    return (
        <div className={`input-wrapper ${wrapperClassName}`}>
            {label && <label className="input-label">{label}</label>}

            <div className="input-container">
                {Icon && (
                    <Icon
                        className={`input-icon ${onIconClick ? 'clickable' : ''}`}
                        size={18}
                        onClick={onIconClick}
                        style={onIconClick ? { cursor: 'pointer', pointerEvents: 'auto' } : {}}
                    />
                )}
                <input
                    className={`input-field ${Icon ? 'has-icon' : ''} ${error ? 'has-error' : ''} ${className}`}
                    {...props}
                />
            </div>

            {error && <span className="input-error">{error}</span>}
        </div>
    );
};

export default Input;
