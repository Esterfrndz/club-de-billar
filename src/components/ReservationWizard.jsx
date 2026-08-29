import React, { useState, useEffect } from 'react';
import { todayLocalISO } from '../dateUtils';
import './ReservationWizard.css';

/*
  Props:
  - isOpen: boolean
  - onClose: function
  - onSubmit: function(reservationData)
  - tableData: object { id, name, colorClass }
  - checkAvailability: function(tableId, date, time) -> boolean
*/
export function ReservationWizard({ isOpen, onClose, onSubmit, tableData, checkAvailability, isLargeFont, setIsLargeFont, memberName, memberId, memberNumber, reservations, members, onJoinReservation }) {
    const [step, setStep] = useState(1);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isSolo, setIsSolo] = useState(null); // null, true, or false
    const [companionMemberId, setCompanionMemberId] = useState('');

    // No step 2 formData needed now

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setTime('');
            setIsSolo(null);
            setCompanionMemberId('');
            setDate(todayLocalISO());
        }
    }, [isOpen]);

    if (!isOpen || !tableData) return null;

    const handleNextFromTime = () => setStep(2); // Go to solo/accompanied selection
    const handleNextFromType = () => setStep(3); // Go to summary
    const handleBack = () => {
        if (step === 3) setStep(2);
        else if (step === 2) setStep(1);
    };

    const handleSubmit = () => {
        const companionMember = members.find(m => m.id === companionMemberId);
        onSubmit({
            tableId: tableData.id,
            date,
            time,
            isSolo,
            companionName: isSolo ? '' : (companionMember?.name || ''),
            companionMemberId: isSolo ? '' : companionMemberId
        });
    };

    // Helper to checking validity for steps
    const isStep1Valid = date && time;
    const isStep2Valid = isSolo !== null && (isSolo === true || companionMemberId !== '');

    return (
        <div className="wizard-overlay">
            <div className="wizard-container">
                {/* Top Header / Progress */}
                <div className="wizard-header">
                    <div className="wizard-header-actions">
                        <button
                            className={`font-control-btn wizard-font-btn ${isLargeFont ? 'active' : ''}`}
                            onClick={() => setIsLargeFont(!isLargeFont)}
                            title={isLargeFont ? "Letra normal" : "Aumentar letra"}
                        >
                            A
                        </button>
                        <button className="close-wizard-btn" onClick={onClose}>&times;</button>
                    </div>
                    <div className="progress-steps">
                        <div className={`step-circle ${step === 1 ? 'active' : ''}`}>1</div>
                        <div className="step-line"></div>
                        <div className={`step-circle ${step === 2 ? 'active' : ''}`}>2</div>
                        <div className="step-line"></div>
                        <div className={`step-circle ${step === 3 ? 'active' : ''}`}>3</div>
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
                                            min={todayLocalISO()}
                                        />
                                    </div>

                                    <label>Horarios disponibles</label>
                                    <div className="time-slots-grid">
                                        {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(slot => {
                                            const isTaken = checkAvailability(tableData.id, date, slot);

                                            // Find if this slot is a solo reservation
                                            const soloReservation = reservations.find(r =>
                                                r.table_id === tableData.id &&
                                                r.date === date &&
                                                r.time === slot &&
                                                r.is_solo === true &&
                                                !r.companion_name &&
                                                String(r.member_id) !== String(memberId)
                                            );

                                            // Check if time has already passed for today
                                            const now = new Date();
                                            const today = todayLocalISO();
                                            const currentHour = now.getHours();
                                            const slotHour = parseInt(slot.split(':')[0]);
                                            const isPast = date === today && slotHour < currentHour;

                                            const isDisabled = (isTaken && !soloReservation) || isPast;

                                            return (
                                                <div key={slot} className="time-slot-wrapper">
                                                    <button
                                                        className={`time-slot ${time === slot ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                                                        onClick={() => !isDisabled && setTime(slot)}
                                                        disabled={isDisabled}
                                                    >
                                                        {slot}
                                                    </button>
                                                    {soloReservation && (
                                                        <div className="join-slot-info">
                                                            <div className="join-slot-name">{soloReservation.customer_name}</div>
                                                            <button
                                                                className="join-slot-button"
                                                                onClick={() => onJoinReservation && onJoinReservation(soloReservation.id)}
                                                            >
                                                                Unirse
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="step-actions">
                                    <button className="btn-next" disabled={!isStep1Valid} onClick={handleNextFromTime}>Continuar</button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="step-content">
                                <h2>¿Juegas solo o acompañado?</h2>
                                <p className="step-description">Selecciona si vas a jugar solo o con un acompañante</p>

                                <div className="reservation-type-buttons">
                                    <button
                                        className={`type-button ${isSolo === true ? 'selected' : ''}`}
                                        onClick={() => {
                                            setIsSolo(true);
                                            setCompanionMemberId('');
                                        }}
                                    >
                                        <span className="type-icon">🎱</span>
                                        <span className="type-label">Juego Solo</span>
                                        <span className="type-hint">Otros pueden unirse</span>
                                    </button>

                                    <button
                                        className={`type-button ${isSolo === false ? 'selected' : ''}`}
                                        onClick={() => setIsSolo(false)}
                                    >
                                        <span className="type-icon">👥</span>
                                        <span className="type-label">Juego Acompañado</span>
                                        <span className="type-hint">Con un compañero</span>
                                    </button>
                                </div>

                                {isSolo === false && (
                                    <div className="companion-input-group">
                                        <label>Selecciona tu acompañante</label>
                                        <select
                                            value={companionMemberId}
                                            onChange={e => setCompanionMemberId(e.target.value)}
                                            className="companion-select"
                                        >
                                            <option value="">-- Selecciona un socio --</option>
                                            {members
                                                .filter(m => String(m.id) !== String(memberId))
                                                .map(member => (
                                                    <option key={member.id} value={member.id}>
                                                        {member.name}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                )}

                                <div className="step-actions">
                                    <button className="btn-next" disabled={!isStep2Valid} onClick={handleNextFromType}>Continuar</button>
                                </div>
                            </div>
                        )}

                        {/* Step 2 removed */}

                        {step === 3 && (
                            <div className="step-content">
                                <h2>Resumen de la reserva</h2>
                                <p className="summary-text">Por favor revisa los datos antes de confirmar.</p>

                                <div className="summary-review-box">
                                    <p><strong>Mesa:</strong> {tableData.name}</p>
                                    <p><strong>Fecha:</strong> {formatDate(date)}</p>
                                    <p><strong>Hora:</strong> {time}</p>
                                    <p><strong>Tipo:</strong> {isSolo ? '🎱 Solo (otros pueden unirse)' : `👥 Acompañado${companionMemberId ? ` - ${members.find(m => m.id === companionMemberId)?.name}` : ''}`}</p>
                                    <hr />
                                    <p><strong>Nombre:</strong> {memberName}</p>
                                    <p><strong>Socio nº:</strong> {memberNumber || '—'}</p>
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
                                <div className={`sidebar-icon ${tableData.colorClass}`}>🎱</div>
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
