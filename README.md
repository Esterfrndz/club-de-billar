# Systema de Reservas - Club de Billar Paterna

Este es un sistema de gestión de reservas de mesas de billar moderno, construido con **React**, **Vite** y **Supabase**.

## 🚀 Características

- **Gestión de Reservas**: Interfaz fluida para que los socios reserven sus mesas.
- **Base de Datos en Tiempo Real**: Integrado con Supabase para persistencia de datos.
- **Confirmación por WhatsApp**: Envía automáticamente un mensaje de confirmación al socio con un enlace para cancelar si lo necesita.
- **Panel de Admin**: Vista de calendario para administradores con capacidad de ver y eliminar reservas.
- **Estado Dinámico**: Muestra "Abierto" o "Cerrado" automáticamente según la hora (09:00 - 21:00).
- **Diseño Premium**: Interfaz limpia, responsiva y profesional.

## 🛠️ Instalación y Configuración

1. **Clonar el repositorio**:
   ```bash
   git clone [URL-DE-TU-REPOSITORIO]
   cd reservas
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Variables de Entorno**:
   Crea un archivo `.env.local` en la raíz del proyecto y añade tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
   ```

4. **Base de Datos**:
   Ejecuta el script SQL que se encuentra en `supabase/schema.sql` (puedes crear esta carpeta o usar el código proporcionado anteriormente) en el editor SQL de Supabase para crear la tabla `reservations`.

5. **Iniciar en desarrollo**:
   ```bash
   npm run dev
   ```

## 📦 Despliegue

Para desplegar el proyecto, puedes usar plataformas como **Vercel** o **Netlify**. Asegúrate de configurar las variables de entorno en el panel de control de la plataforma que elijas.

---

Desarrollado con ❤️ para el Club de Billar Paterna.
