import React, { useState } from 'react';
import './MemberManager.css';

export function MemberManager({ members, onAddMember, onDeleteMember, onUpdateMember, loading }) {
    const [newName, setNewName] = useState('');
    const [isSeeding, setIsSeeding] = useState(false);
    const [editingUrls, setEditingUrls] = useState({});

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        const result = await onAddMember(newName.trim());
        if (result.success) {
            setNewName('');
        } else {
            alert('Error: ' + result.error);
        }
    };

    const handleUrlChange = (id, url) => {
        setEditingUrls(prev => ({ ...prev, [id]: url }));
    };

    const handleSaveUrl = async (id) => {
        const url = editingUrls[id];
        if (url === undefined) return;

        const result = await onUpdateMember(id, { photo_url: url });
        if (result.success) {
            // Success alert or some feedback
        } else {
            alert('Error al actualizar: ' + result.error);
        }
    };

    const seedMembers = async () => {
        // ... (existing seed members code remains same)
        if (!window.confirm('¿Quieres cargar la lista inicial de socios fundadores?')) return;

        setIsSeeding(true);
        const initialMembers = [
            "José Miguel Bailen Colas", "Francisco José Martínez Navarro", "Luis Serra Gascó",
            "Francisco Mir Guillem", "Jesús Fernández Sánchez", "José Cosín Blanch",
            "Pablo Hernández Sinsaez", "Juan Manuel Molina Minguez", "Juan García Cuesta",
            "Juan Sánchez Ranchal", "Juan José Cervera Guiot", "Cesar Chavarria de Oñate",
            "Francisco Javier García Moreno", "Antonio Vilreales Clemente", "Julián Díaz Sardinero",
            "Vicente Bort Veintimilla", "Jesús Romero Morcillo", "Antonio Piña Piña",
            "José María Moreno Soria", "José María Martínez Santamaria", "Pedro Miguel Martínez Cano",
            "Ángel Sánchez Villarrubia", "Joaquín Cano Quintanilla", "Vicent Bailen Villanueva",
            "José Alfaro Calero", "Luis Martínez Orrico", "Juan Ramón López Sánchez",
            "Santiago Quilez", "Rafael Blanco Ruiz", "Francisco Garrido Sánchez",
            "Alfredo Valdivieso Sastre", "Juan Fernandez Guindos", "Antonio Ruiz Bayon",
            "Antonio Gonzalez Algaba", "Vicente Carrasco Martínez"
        ];

        for (const name of initialMembers) {
            if (!members.some(m => m.name === name)) {
                await onAddMember(name);
            }
        }
        setIsSeeding(false);
        alert('Socios cargados con éxito.');
    };

    return (
        <div className="member-manager-container">
            <div className="member-manager-header">
                <h2>Gestión de Socios</h2>
                <div className="member-stats">
                    {members.length} socios registrados
                    <button className="btn-seed" onClick={seedMembers} disabled={isSeeding || loading}>
                        {isSeeding ? 'CARGANDO...' : 'CARGAR LISTA INICIAL'}
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="add-member-form">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre completo del socio..."
                    required
                />
                <button type="submit" className="btn-add-member" disabled={loading}>
                    AÑADIR SOCIO
                </button>
            </form>

            {loading && !isSeeding ? (
                <div className="loading-spinner">Cargando socios...</div>
            ) : (
                <div className="members-list">
                    <table>
                        <thead>
                            <tr>
                                <th>Foto</th>
                                <th>Nombre / URL Imagen</th>
                                <th>Código</th>
                                <th>Admin</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr key={member.id}>
                                    <td>
                                        {member.photo_url ? (
                                            <img src={member.photo_url} alt={member.name} className="member-photo" />
                                        ) : (
                                            <div className="member-photo-placeholder">👤</div>
                                        )}
                                    </td>
                                    <td>
                                        <div className="member-info-edit">
                                            <strong>{member.name}</strong>
                                            <div className="photo-url-edit">
                                                <input
                                                    type="text"
                                                    placeholder="URL de la foto..."
                                                    defaultValue={member.photo_url || ''}
                                                    onChange={(e) => handleUrlChange(member.id, e.target.value)}
                                                    className="url-input"
                                                />
                                                <button
                                                    onClick={() => handleSaveUrl(member.id)}
                                                    className="btn-save-url"
                                                    disabled={editingUrls[member.id] === undefined || editingUrls[member.id] === member.photo_url}
                                                >
                                                    OK
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="access-code-badge">{member.access_code}</span>
                                    </td>
                                    <td>
                                        {member.is_admin ? (
                                            <span className="admin-badge">✓ Admin</span>
                                        ) : (
                                            <span className="regular-badge">Socio</span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className="btn-delete-member"
                                            onClick={() => {
                                                if (window.confirm(`¿Seguro que quieres eliminar a ${member.name}?`)) {
                                                    onDeleteMember(member.id);
                                                }
                                            }}
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {members.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="empty-row">No hay socios registrados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
