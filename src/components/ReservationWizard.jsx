import React, { useState, useEffect } from 'react';
import './ReservationWizard.css';

/*
  Props:
  - isOpen: boolean
  - onClose: function
  - onSubmit: function(reservationData)
  - tableData: object { id, name, colorClass }
  - checkAvailability: function(tableId, date, time) -> boolean
*/
export function ReservationWizard({ isOpen, onClose, onSubmit, tableData, checkAvailability }) {
    const [step, setStep] = useState(1);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');

    // Step 2 Data
    const [formData, setFormData] = useState({
        name: '',
        memberId: '',
        mobile: ''
    });

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFormData({ name: '', memberId: '', mobile: '' });
            setTime('');
            const today = new Date().toISOString().split('T')[0];
            setDate(today);
        }
    }, [isOpen]);

    if (!isOpen || !tableData) return null;

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleSubmit = () => {
        onSubmit({
            tableId: tableData.id,
            date,
            time,
            ...formData
        });
    };

    // Helper to checking validity for steps
    const isStep1Valid = date && time;
    const isStep2Valid = formData.name && formData.memberId && formData.mobile;

    return (
        <div className="wizard-overlay">
            <div className="wizard-container">
                {/* Top Header / Progress */}
                <div className="wizard-header">
                    <button className="close-wizard-btn" onClick={onClose}>&times;</button>
                    <div className="progress-steps">
                        <div className={`step-circle ${step >= 1 ? 'active' : ''}`}>1</div>
                        <div className="step-line"></div>
                        <div className={`step-circle ${step >= 2 ? 'active' : ''}`}>2</div>
                        <div className="step-line"></div>
                        <div className={`step-circle ${step >= 3 ? 'active' : ''}`}>3</div>
                    </div>
                </div>

                <div className="wizard-body">
                    {/* LEFT CONTENT AREA */}
                    <div className="wizard-content">
                        {step > 1 && (
                            <button className="back-link" onClick={handleBack}>&lt; Volver</button>
                        )}

                        {step === 1 && (
                            <div className="step-content">
                                <h2>Selecciona una hora</h2>
                                <div className="datetime-selector">
                                    <div className="form-group">
                                        <label>Fecha</label>
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={e => { setDate(e.target.value); setTime(''); }}
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>

                                    <label>Horarios disponibles</label>
                                    <div className="time-slots-grid">
                                        {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(slot => {
                                            const isTaken = checkAvailability(tableData.id, date, slot);
                                            return (
                                                <button
                                                    key={slot}
                                                    className={`time-slot ${time === slot ? 'selected' : ''} ${isTaken ? 'disabled' : ''}`}
                                                    onClick={() => !isTaken && setTime(slot)}
                                                    disabled={isTaken}
                                                >
                                                    {slot}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="step-actions">
                                    <button className="btn-next" disabled={!isStep1Valid} onClick={handleNext}>Continuar</button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="step-content">
                                <h2>Detalles de la reserva</h2>

                                <div className="form-group">
                                    <label>Nombre completo</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej. Juan Pérez"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Num. de Socio</label>
                                    <input
                                        type="text"
                                        value={formData.memberId}
                                        onChange={e => setFormData({ ...formData, memberId: e.target.value })}
                                        placeholder="Ej. 12345"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Núm. móvil</label>
                                    <input
                                        type="tel"
                                        value={formData.mobile}
                                        onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                        placeholder="600 000 000"
                                    />
                                </div>

                                <div className="step-actions">
                                    <button className="btn-next" disabled={!isStep2Valid} onClick={handleNext}>Continuar</button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="step-content">
                                <h2>Resumen de la reserva</h2>
                                <p className="summary-text">Por favor revisa los datos antes de confirmar.</p>

                                <div className="summary-review-box">
                                    <p><strong>Mesa:</strong> {tableData.name}</p>
                                    <p><strong>Fecha:</strong> {formatDate(date)}</p>
                                    <p><strong>Hora:</strong> {time}</p>
                                    <hr />
                                    <p><strong>Nombre:</strong> {formData.name}</p>
                                    <p><strong>Socio:</strong> {formData.memberId}</p>
                                    <p><strong>Móvil:</strong> {formData.mobile}</p>
                                </div>

                                <div className="step-actions">
                                    <button className="btn-confirm" onClick={handleSubmit}>CONFIRMAR RESERVA</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDEBAR (SUMMARY) */}
                    <div className="wizard-sidebar">
                        <h3>Resumen</h3>
                        <div className="sidebar-card">
                            <div className="sidebar-item">
                                <div className="sidebar-icon">🏢</div>
                                <div>
                                    <strong>Club de billar Paterna</strong>
                                    <div className="text-sm">Ubicación (por completar)</div>
                                </div>
                            </div>

                            <div className="sidebar-item">
                                <div className="sidebar-icon">👥</div>
                                <div>
                                    <strong>Cualquier persona disponible</strong>
                                </div>
                            </div>

                            <div className="sidebar-item">
                                <div className={`sidebar-icon ${tableData.colorClass}`}>🚪</div>
                                <div>
                                    <strong>{tableData.name}</strong>
                                    <div className="text-sm">1 hora</div>
                                    {date && time && <div className="text-sm highlight">{formatDate(date)} a las {time}</div>}
                                </div>
                            </div>

                            <hr className="sidebar-divider" />


                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatDate(dateString) {
    if (!dateString) return '';
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', options);
}
