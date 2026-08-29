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
