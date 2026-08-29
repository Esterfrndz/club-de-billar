import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sin valores por defecto: antes había una URL y una clave escritas a mano
// como fallback, así que faltaba el .env.local y la app seguía funcionando en
// silencio contra producción. Mejor fallar aquí que descubrirlo desplegando.
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Faltan las credenciales de Supabase. Crea un archivo .env.local en la raíz ' +
        'del proyecto con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. ' +
        'En Vercel/Netlify, configúralas como variables de entorno del proyecto.'
    )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
