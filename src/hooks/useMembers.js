import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Valida un código de acceso contra el servidor.
 *
 * Función suelta a propósito: el portal de acceso solo necesita esto, y antes
 * montaba un `useMembers()` entero solo para llegar aquí (lo que disparaba una
 * segunda descarga de la lista de socios en cada carga de página).
 */
export async function verifyAccessCode(code) {
    try {
        const { data, error } = await supabase.rpc('verify_access_code', { p_code: code });

        // El bloqueo por demasiados intentos llega como error del RPC, con un
        // mensaje pensado para mostrarse tal cual (no el genérico de abajo).
        if (error) {
            if (error.message?.startsWith('Demasiados intentos')) {
                return { success: false, error: error.message };
            }
            throw error;
        }
        if (!data || data.length === 0) {
            return { success: false, error: 'Código incorrecto' };
        }

        const member = data[0];
        return {
            success: true,
            id: member.id,
            name: member.name,
            code,
            isAdmin: member.is_admin || false,
            photoUrl: member.photo_url || null
        };
    } catch (err) {
        console.error('Error validando el código:', err);
        return { success: false, error: 'Error al validar el código' };
    }
}

export function useMembers(memberCode = '') {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // El servidor decide qué campos devuelve según quién pregunta: `access_code`
    // solo viaja si el que llama es administrador.
    const fetchMembers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error } = await supabase.rpc('list_members', {
                p_code: memberCode || null
            });

            if (error) throw error;
            setMembers(data || []);
        } catch (err) {
            console.error('Error fetching members:', err);
            setError('No se pudo cargar la lista de socios.');
        } finally {
            setLoading(false);
        }
    }, [memberCode]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const addMember = useCallback(async (name) => {
        if (!name) return { success: false, error: 'El nombre es obligatorio' };

        try {
            const { data, error } = await supabase.rpc('admin_add_member', {
                p_code: memberCode,
                p_name: name
            });

            if (error) throw error;

            const created = data[0];
            setMembers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            return { success: true, data: created };
        } catch (err) {
            console.error('Error adding member:', err);
            return { success: false, error: err.message };
        }
    }, [memberCode]);

    const deleteMember = useCallback(async (id) => {
        try {
            const { error } = await supabase.rpc('admin_delete_member', {
                p_code: memberCode,
                p_target_id: String(id)
            });

            if (error) throw error;
            setMembers(prev => prev.filter(m => m.id !== id));
            return { success: true };
        } catch (err) {
            console.error('Error deleting member:', err);
            return { success: false, error: err.message };
        }
    }, [memberCode]);

    /**
     * Antes esto era `updateMember(id, updates)` con un objeto libre, así que
     * una llamada manual con `{ is_admin: true }` bastaba para autoascenderse.
     * Ahora solo existe el camino de la foto, y el servidor comprueba que seas
     * admin o el dueño de la ficha.
     */
    const updateMemberPhoto = useCallback(async (id, photoUrl) => {
        try {
            const { data, error } = await supabase.rpc('set_member_photo', {
                p_code: memberCode,
                p_target_id: String(id),
                p_photo_url: photoUrl || null
            });

            if (error) throw error;

            const updated = data[0];
            setMembers(prev => prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m)));
            return { success: true, data: updated };
        } catch (err) {
            console.error('Error updating member photo:', err);
            return { success: false, error: err.message };
        }
    }, [memberCode]);

    const uploadMemberPhoto = useCallback(async (id, file) => {
        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
            return { success: false, error: 'El archivo debe ser una imagen (JPG, PNG, WEBP o GIF).' };
        }
        if (file.size > MAX_PHOTO_BYTES) {
            return { success: false, error: 'La imagen no puede superar los 5 MB.' };
        }

        try {
            const fileExt = file.name.split('.').pop().toLowerCase();
            const filePath = `avatars/${id}-${crypto.randomUUID()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('member-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('member-photos')
                .getPublicUrl(filePath);

            return await updateMemberPhoto(id, publicUrl);
        } catch (err) {
            console.error('Error uploading photo:', err);
            return { success: false, error: err.message };
        }
    }, [updateMemberPhoto]);

    return {
        members,
        loading,
        error,
        addMember,
        deleteMember,
        updateMemberPhoto,
        uploadMemberPhoto,
        refreshMembers: fetchMembers
    };
}
