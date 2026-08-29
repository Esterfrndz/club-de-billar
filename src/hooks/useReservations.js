import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useReservations(memberCode = '') {
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // La lectura sigue siendo directa: tras la migración la tabla ya no
    // contiene códigos de acceso, y la app necesita ver la ocupación de las
    // mesas aunque nadie haya entrado todavía.
    const fetchReservations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error } = await supabase.from('reservations').select('*');

            if (error) throw error;
            setReservations(data || []);
        } catch (err) {
            console.error('Error fetching reservations:', err);
            setError('No se pudieron cargar las reservas.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReservations();
    }, [fetchReservations]);

    /**
     * La disponibilidad la decide el índice único de la base de datos, no el
     * estado local: antes dos personas en dispositivos distintos podían
     * reservar el mismo hueco porque cada una miraba su propia copia.
     */
    const addReservation = useCallback(async (tableId, date, time, isSolo, companionMemberId = '') => {
        try {
            const { data, error } = await supabase.rpc('create_reservation', {
                p_code: memberCode,
                p_table_id: tableId,
                p_date: date,
                p_time: time,
                p_is_solo: isSolo,
                p_companion_id: companionMemberId || null
            });

            if (error) throw error;

            setReservations(prev => [...prev, data]);
            return { success: true, data };
        } catch (err) {
            console.error('Error adding reservation:', err);
            return { success: false, error: err.message };
        }
    }, [memberCode]);

    const deleteReservation = useCallback(async (id) => {
        try {
            const { data, error } = await supabase.rpc('delete_reservation', {
                p_code: memberCode,
                p_id: String(id)
            });

            if (error) throw error;

            if (data === 'left') {
                // Éramos el acompañante: la reserva sigue viva, sin nosotros.
                setReservations(prev => prev.map(r =>
                    String(r.id) === String(id)
                        ? { ...r, is_solo: true, companion_name: null, companion_member_id: null }
                        : r
                ));
                return { success: true, isLeave: true };
            }

            setReservations(prev => prev.filter(r => String(r.id) !== String(id)));
            return { success: true, isLeave: false };
        } catch (err) {
            console.error('Error deleting reservation:', err);
            return { success: false, error: err.message };
        }
    }, [memberCode]);

    const joinReservation = useCallback(async (reservationId) => {
        try {
            const { data, error } = await supabase.rpc('join_reservation', {
                p_code: memberCode,
                p_id: String(reservationId)
            });

            if (error) throw error;

            setReservations(prev => prev.map(r =>
                String(r.id) === String(reservationId) ? data : r
            ));
            return { success: true, data };
        } catch (err) {
            console.error('Error joining reservation:', err);
            return { success: false, error: err.message };
        }
    }, [memberCode]);

    const isSlotOccupied = useCallback((tableId, date, time) => {
        return reservations.some(r => r.table_id === tableId && r.date === date && r.time === time);
    }, [reservations]);

    return {
        reservations,
        addReservation,
        deleteReservation,
        checkAvailability: isSlotOccupied,
        joinReservation,
        refreshReservations: fetchReservations,
        loading,
        error
    };
}
