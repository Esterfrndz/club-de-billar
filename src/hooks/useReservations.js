import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useReservations() {
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchReservations();
    }, []);

    const fetchReservations = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('reservations')
                .select('*');

            if (error) throw error;
            setReservations(data || []);
        } catch (err) {
            console.error('Error fetching reservations:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addReservation = async (tableId, date, time, customerName, memberId = '', mobile = '') => {
        // Basic validation
        if (!tableId || !date || !time || !customerName) {
            return { success: false, error: "Faltan datos obligatorios" };
        }

        // Check availability strictly against current state (optimistic)
        // Ideally should double-check on server, but this suffices for now
        const isTaken = reservations.some(
            r => r.table_id === tableId && r.date === date && r.time === time
        );

        if (isTaken) {
            return { success: false, error: "Este horario ya está reservado" };
        }

        try {
            const { data, error } = await supabase
                .from('reservations')
                .insert([
                    {
                        table_id: tableId,
                        date,
                        time,
                        customer_name: customerName,
                        member_id: memberId,
                        mobile: mobile
                    }
                ])
                .select();

            if (error) throw error;

            // Optimistic update or refetch
            setReservations(prev => [...prev, ...data]);
            return { success: true, data };
        } catch (err) {
            console.error('Error adding reservation:', err);
            return { success: false, error: err.message };
        }
    };

    const deleteReservation = async (id) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setReservations(prev => prev.filter(r => r.id !== id));
            return { success: true };
        } catch (err) {
            console.error('Error deleting reservation:', err);
            return { success: false, error: err.message };
        }
    };

    const getReservationsByDate = (date) => {
        return reservations.filter(r => r.date === date);
    };

    // Note: checkAvailability now checks against table_id (DB column) instead of tableId
    const isSlotOccupied = (tableId, date, time) => {
        return reservations.some(r => r.table_id === tableId && r.date === date && r.time === time);
    };

    return {
        reservations,
        addReservation,
        deleteReservation,
        getReservationsByDate,
        checkAvailability: isSlotOccupied,
        loading,
        error
    };
}
