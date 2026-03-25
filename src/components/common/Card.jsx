import React from 'react';
import './Card.css';

const Card = ({ children, className = '', padding = 'md', ...props }) => {
    return (
        <div className={`card card-padding-${padding} ${className}`} {...props}>
            {children}
        </div>
    );
};

export default Card;
