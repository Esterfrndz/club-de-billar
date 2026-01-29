import React, { useState, useEffect } from 'react';
import './ReservationModal.css';

/*
  Props:
  - isOpen: boolean
  - onClose: function
  - onSubmit: function(reservationData)
  - tableId: number | null
  - checkAvailability: function(tableId, date, time) -> boolean
*/
export function ReservationModal({ isOpen, onClose, onSubmit, tableId, checkAvailability }) {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            setError('');
            setTime('');
            setName('');
            // Default to today
            const today = new Date().toISOString().split('T')[0];
            setDate(today);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!date || !time || !name) {
            setError('Por favor completa todos los campos.');
            return;
        }

        if (checkAvailability(tableId, date, time)) {
            setError('Este horario ya está reservado.');
            return;
        }

        onSubmit({ tableId, date, time, customerName: name });
        onClose();
    };

    // Generate time slots (e.g., 10:00 to 23:00)
    const timeSlots = [];
    for (let i = 10; i <= 23; i++) {
        const slot = `${i.toString().padStart(2, '0')}:00`;
        timeSlots.push(slot);
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Reservar Mesa {tableId}</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Fecha</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Hora</label>
                        <div className="time-slots-grid">
                            {timeSlots.map(slot => {
                                const isTaken = checkAvailability(tableId, date, slot);
                                return (
                                    <button
                                        type="button"
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
                        <input type="hidden" value={time} required />
                    </div>

                    <div className="form-group">
                        <label>Nombre del Cliente</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Tu nombre completo"
                            required
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-submit" disabled={!time}>Confirmar Reserva</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
