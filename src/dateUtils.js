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
