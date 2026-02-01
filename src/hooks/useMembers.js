import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useMembers() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setMembers(data || []);
        } catch (err) {
            console.error('Error fetching members:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addMember = async (name) => {
        if (!name) return { success: false, error: "El nombre es obligatorio" };

        // Generate random 4-digit code
        const accessCode = Math.floor(1000 + Math.random() * 9000).toString();

        try {
            const { data, error } = await supabase
                .from('members')
                .insert([{ name, access_code: accessCode }])
                .select();

            if (error) throw error;
            setMembers(prev => [...prev, ...data].sort((a, b) => a.name.localeCompare(b.name)));
            return { success: true, data: data[0] };
        } catch (err) {
            console.error('Error adding member:', err);
            return { success: false, error: err.message };
        }
    };

    const deleteMember = async (id) => {
        try {
            const { error } = await supabase
                .from('members')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setMembers(prev => prev.filter(m => m.id !== id));
            return { success: true };
        } catch (err) {
            console.error('Error deleting member:', err);
            return { success: false, error: err.message };
        }
    };

    const checkAccess = async (code) => {
        try {
            const { data, error } = await supabase
                .from('members')
                .select('id, name, access_code, is_admin, photo_url')
                .eq('access_code', code)
                .single();

            if (error) return { success: false, error: "Código incorrecto" };
            return {
                success: true,
                id: data.id,
                name: data.name,
                code: data.access_code,
                isAdmin: data.is_admin || false,
                photoUrl: data.photo_url || null
            };
        } catch (err) {
            return { success: false, error: "Error al validar el código" };
        }
    };

    const updateMember = async (id, updates) => {
        try {
            const { data, error } = await supabase
                .from('members')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) throw error;
            setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
            return { success: true, data: data[0] };
        } catch (err) {
            console.error('Error updating member:', err);
            return { success: false, error: err.message };
        }
    };

    const uploadMemberPhoto = async (id, file) => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('member-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('member-photos')
                .getPublicUrl(filePath);

            // Update member record with the new photo URL
            return await updateMember(id, { photo_url: publicUrl });
        } catch (err) {
            console.error('Error uploading photo:', err);
            return { success: false, error: err.message };
        }
    };

    return {
        members,
        loading,
        error,
        addMember,
        deleteMember,
        updateMember,
        uploadMemberPhoto,
        checkAccess,
        refreshMembers: fetchMembers
    };
}
