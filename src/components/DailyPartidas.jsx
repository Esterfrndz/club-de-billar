import React from 'react';
import './DailyPartidas.css';

export const DailyPartidas = ({ reservations }) => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Filter reservations for today and sort by time
    const todayReservations = reservations
        .filter(res => res.date === today)
        .sort((a, b) => a.time.localeCompare(b.time));

    const getMonthAbbr = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('default', { month: 'short' }).toUpperCase();
    };

    const getDay = (dateStr) => {
        return dateStr.split('-')[2];
    };

    const getYear = (dateStr) => {
        return dateStr.split('-')[0];
    };

    return (
        <div className="daily-partidas-container">
            <div className="section-header">
                <h2 className="section-title">Partidas de Hoy</h2>
            </div>

            {todayReservations.length === 0 ? (
                <div className="no-partidas">
                    <p>No hay partidas programadas para hoy.</p>
                </div>
            ) : (
                <div className="partidas-list">
                    {todayReservations.map((res) => (
                        <div key={res.id} className="partida-item">
                            <div className="date-card">
                                <div className="date-header">{getMonthAbbr(res.date)}</div>
                                <div className="date-body">
                                    <span className="day-num">{getDay(res.date)}</span>
                                    <span className="year-num">{getYear(res.date)}</span>
                                </div>
                            </div>
                            <div className="partida-details">
                                <h3 className="partida-title">
                                    Mesa {res.table_id} - {res.member_name || 'Socio'}
                                </h3>
                                <div className="partida-info">
                                    <span className="info-item">
                                        <span className="info-icon">🕒</span> Hora: {res.time}
                                    </span>
                                    <span className="info-item">
                                        <span className="info-icon">📍</span> Club de billar Paterna
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
