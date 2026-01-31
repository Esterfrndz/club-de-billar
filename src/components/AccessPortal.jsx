import React, { useState } from 'react';
import { useMembers } from '../hooks/useMembers';
import './AccessPortal.css';

export function AccessPortal({ onAccessGranted }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [welcomeName, setWelcomeName] = useState('');
    const { checkAccess, loading } = useMembers();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading || isAnimating) return;

        const result = await checkAccess(code);

        if (result.success) {
            setWelcomeName(result.name);
            setIsAnimating(true);
            setTimeout(() => {
                onAccessGranted(result.name);
            }, 2000); // Give time for the welcome message
        } else {
            setError(true);
            setTimeout(() => setError(false), 500);
            setCode('');
        }
    };

    return (
        <div className={`access-portal-overlay ${welcomeName ? 'access-granted' : ''}`}>
            <div className={`access-portal-container ${isAnimating && !welcomeName ? 'fade-out' : ''}`}>
                <div className="access-portal-card">
                    {welcomeName ? (
                        <div className="welcome-message">
                            <div className="welcome-icon">👋</div>
                            <h1>¡Bienvenido!</h1>
                            <p className="member-welcome-name">{welcomeName}</p>
                            <div className="loading-bar-container">
                                <div className="loading-bar"></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="access-logo">🎱</div>
                            <h1>Club de billar Paterna</h1>
                            <p>Por favor, introduce tu número de acceso de socio.</p>

                            <form onSubmit={handleSubmit} className="access-form">
                                <div className={`input-wrapper ${error ? 'shake' : ''}`}>
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="Código de 4 dígitos"
                                        autoFocus
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                <button type="submit" className="btn-access" disabled={loading}>
                                    {loading ? 'VALIDANDO...' : 'ENTRAR'}
                                </button>
                            </form>

                            {error && <p className="error-message">Código no válido. Contacta con el club si lo has olvidado.</p>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
