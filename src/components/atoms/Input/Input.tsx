import React from 'react';
import PropTypes from 'prop-types';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className,
  ...props
}) => {
  return (
    <div className={styles.inputWrapper}>
      {label && (
        <label htmlFor={props.id} className={styles.label}>
          {label}
        </label>
      )}
      <input
        className={`${styles.input} ${error ? styles.error : ''} ${className || ''}`}
        {...props}
      />
      {error && <span className={styles.errorText}>{error}</span>}
      {helperText && !error && (
        <span className={styles.helperText}>{helperText}</span>
      )}
    </div>
  );
};

Input.propTypes = {
  label: PropTypes.string,
  error: PropTypes.string,
  helperText: PropTypes.string,
};

export default Input;

