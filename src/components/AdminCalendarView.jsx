import React, { useState } from 'react';
import './AdminCalendarView.css';

// Etiquetas de los valores que guarda la reserva (migración 006).
const CATEGORY_LABELS = {
    principiante: 'Principiante',
    avanzado: 'Avanzado',
    competitivo: 'Competitivo',
};

const GAME_MODE_LABELS = {
    tres_bandas: 'Tres bandas',
    libre: 'Libre',
    una_banda: 'Una banda',
    cuadro: 'Cuadro (Balkline)',
};

export function AdminCalendarView({ reservations, onDelete, isAdmin = false, currentMemberId = '' }) {
    // Group reservations by date
    const groupedReservations = reservations.reduce((acc, res) => {
        if (!acc[res.date]) acc[res.date] = [];
        acc[res.date].push(res);
        return acc;
    }, {});

    // Sort dates
    const sortedDates = Object.keys(groupedReservations).sort();

    const isMine = (value) => String(value) === String(currentMemberId);

    const handleDelete = async (id, info, reservation) => {
        const isCompanion = !isAdmin && isMine(reservation.companion_member_id);
        const action = isAdmin ? 'eliminar' : (isCompanion ? 'salir de' : 'cancelar');

        if (window.confirm(`¿Estás seguro de que quieres ${action} la reserva de ${info}?`)) {
            // Quién puede borrar qué lo decide el servidor: aquí solo se elige
            // el texto del mensaje.
            const result = await onDelete(id);

            if (result && !result.success) {
                alert(`Error al ${action}: ${result.error}`);
            } else if (result && result.success && result.isLeave) {
                alert('Has salido de la reserva exitosamente. La reserva sigue disponible para el jugador principal.');
            }
        }
    };

    return (
        <div className="admin-calendar-container">
            <div className="calendar-header">
                <h2>{isAdmin ? 'Gestión de Reservas' : 'Mis Reservas'}</h2>
                <div className="reservation-count">
                    {isAdmin ? `${reservations.length} reservas en total` : `Tienes ${reservations.length} reservas`}
                </div>
            </div>

            {reservations.length === 0 ? (
                <div className="empty-calendar">
                    <div className="empty-icon">📅</div>
                    <p>{isAdmin ? 'No hay reservas registradas todavía.' : 'No tienes ninguna reserva registrada.'}</p>
                </div>
            ) : (
                <div className="calendar-content">
                    {sortedDates.map(date => (
                        <div key={date} className="date-group">
                            <h3 className="date-heading">{formatDateHeader(date)}</h3>
                            <div className="reservations-grid">
                                {groupedReservations[date]
                                    .sort((a, b) => a.time.localeCompare(b.time))
                                    .map(res => (
                                        <div key={res.id} className="reservation-card">
                                            <div className="res-time">{res.time}</div>
                                            <div className="res-details">
                                                <div className="res-name">
                                                    {res.customer_name}
                                                    {!isAdmin && isMine(res.member_id) && (
                                                        <span className="role-badge">Tú</span>
                                                    )}
                                                </div>
                                                {res.companion_name && (
                                                    <div className="res-companion">
                                                        + {res.companion_name}
                                                        {!isAdmin && isMine(res.companion_member_id) && (
                                                            <span className="role-badge">Tú</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="res-table">Mesa {res.table_id}</div>
                                                {(res.game_mode || res.category) && (
                                                    <div className="res-modalidad">
                                                        {[GAME_MODE_LABELS[res.game_mode], CATEGORY_LABELS[res.category]]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </div>
                                                )}
                                                {/* Aquí se mostraba `member_id` (que era el código de acceso del
                                                    socio) y `mobile` (siempre vacío). El nombre ya sale arriba. */}
                                            </div>
                                            <button
                                                className="btn-delete-res"
                                                onClick={() => handleDelete(res.id, res.customer_name, res)}
                                                title={isAdmin ? "Eliminar reserva" : "Cancelar reserva"}
                                            >
                                                {isAdmin ? 'BORRAR' : 'CANCELAR'}
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function formatDateHeader(dateString) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', options);
}
