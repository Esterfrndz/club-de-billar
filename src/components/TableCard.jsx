import React from 'react';
import './TableCard.css';

export function TableCard({ id, name, colorClass, onReserve }) {
    return (
        <div className="table-row">
            <div className={`row-icon ${colorClass}`}>
                🎱
            </div>

            <div className="row-content">
                <h3 className="row-title">{name}</h3>
                <button className="btn-details">Mostrar detalles &gt;</button>
            </div>

            <div className="row-action">
                <button className="btn-reserve-outline" onClick={() => onReserve(id)}>
                    RESERVAR
                </button>
            </div>
        </div>
    );
}
