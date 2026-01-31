import React, { useState } from 'react';
import './AdminCalendarView.css';

export function AdminCalendarView({ reservations, onDelete, isAdmin = false }) {
    // Group reservations by date
    const groupedReservations = reservations.reduce((acc, res) => {
        if (!acc[res.date]) acc[res.date] = [];
        acc[res.date].push(res);
        return acc;
    }, {});

    // Sort dates
    const sortedDates = Object.keys(groupedReservations).sort();

    const handleDelete = async (id, info) => {
        if (window.confirm(`¿Estás seguro de que quieres ${isAdmin ? 'eliminar' : 'cancelar'} la reserva de ${info}?`)) {
            console.log('Intentando eliminar reserva con ID:', id);
            const result = await onDelete(id);
            console.log('Resultado de eliminación:', result);
            if (result && !result.success) {
                console.error('Error al eliminar:', result.error);
                alert(`Error al ${isAdmin ? 'eliminar' : 'cancelar'}: ${result.error}`);
            } else if (result && result.success) {
                console.log('Reserva eliminada exitosamente');
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
                                                <div className="res-name">{res.customer_name}</div>
                                                <div className="res-table">Mesa {res.table_id}</div>
                                                {isAdmin && (
                                                    <div className="res-meta">
                                                        <span>Socio: {res.member_id || 'N/A'}</span>
                                                        <span>Tel: {res.mobile || 'N/A'}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                className="btn-delete-res"
                                                onClick={() => handleDelete(res.id, res.customer_name)}
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
