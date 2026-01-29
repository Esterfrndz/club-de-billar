import React from 'react';
import { TableCard } from './TableCard';
import './TableList.css';

export function TableList({ tables, onReserve }) {
    return (
        <div className="table-list">
            {tables.map(table => (
                <TableCard
                    key={table.id}
                    id={table.id}
                    name={table.name}
                    colorClass={table.colorClass}
                    onReserve={onReserve}
                />
            ))}
        </div>
    );
}
