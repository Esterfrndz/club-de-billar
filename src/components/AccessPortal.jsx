import React, { useState, useEffect } from 'react';
import './AccessPortal.css';

export function AccessPortal({ onAccessGranted }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const CORRECT_CODE = '7123';

    const handleSubmit = (e) => {
        e.preventDefault();
        if (code === CORRECT_CODE) {
            setIsAnimating(true);
            setTimeout(() => {
                onAccessGranted();
            }, 600);
        } else {
            setError(true);
            setTimeout(() => setError(false), 500);
            setCode('');
        }
    };

    return (
        <div className={`access-portal-overlay ${isAnimating ? 'fade-out' : ''}`}>
            <div className="access-portal-container">
                <div className="access-portal-card">
                    <div className="access-logo">🎱</div>
                    <h1>Club de billar Paterna</h1>
                    <p>Por favor, introduce el número de acceso para continuar.</p>

                    <form onSubmit={handleSubmit} className="access-form">
                        <div className={`input-wrapper ${error ? 'shake' : ''}`}>
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Código de acceso"
                                autoFocus
                                required
                            />
                        </div>
                        <button type="submit" className="btn-access">
                            ENTRAR
                        </button>
                    </form>

                    {error && <p className="error-message">Código incorrecto. Inténtalo de nuevo.</p>}
                </div>
            </div>
        </div>
    );
}
