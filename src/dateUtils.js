/**
 * Fecha de hoy en YYYY-MM-DD según la hora LOCAL del navegador.
 *
 * `new Date().toISOString().split('T')[0]` da la fecha en UTC. España va por
 * delante de UTC (+1 o +2), así que justo después de medianoche local el
 * resultado en UTC seguía siendo el día anterior: "PARTIDAS DE HOY" mostraba
 * las de ayer, y el selector de fecha del wizard dejaba reservar (o marcaba
 * como mínimo) una fecha ya pasada.
 */
export function todayLocalISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Hora local a partir de la cual se abren las reservas del día siguiente. */
export const NEXT_DAY_BOOKING_HOUR = 21;

/**
 * true si `dateISO` es mañana y todavía no son las 21:00: las reservas del día
 * siguiente se abren a esa hora. Hoy y pasado mañana en adelante se pueden
 * reservar a cualquier hora. El servidor aplica la misma regla.
 */
export function isNextDayNotOpenYet(dateISO) {
    const now = new Date();
    if (now.getHours() >= NEXT_DAY_BOOKING_HOUR) return false;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return dateISO === `${year}-${month}-${day}`;
}

/**
 * Rango [lunes, domingo] (YYYY-MM-DD, hora local) de la semana que contiene
 * `dateISO`. Se usa para agregar el consumo semanal de horas de un socio.
 */
export function weekRangeLocalISO(dateISO) {
    const [year, month, day] = dateISO.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = domingo ... 6 = sábado
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const toISO = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    return { start: toISO(monday), end: toISO(sunday) };
}
