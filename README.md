# LIA · Tu secretaria para estudiar

App web instalable (PWA) para universitarios que estudian y trabajan: registra tu horario fijo y tus evaluaciones, y LIA reparte tus horas de estudio en tus horas libres reales, sin tocar tu trabajo, tus clases ni tu sueño.

## Estado actual (v0.1)

- Registro de horario fijo y evaluaciones (a mano, escrito o dictado por voz).
- Motor de horarios: reparte las horas de estudio antes de cada evaluación.
- Vistas Hoy, Semana, Lía (chat), Evaluaciones y Perfil.
- Sesión de estudio con temporizador.
- Instalable en Android (Chrome → Instalar app) y iPhone (Safari → Compartir → Agregar a inicio).
- Funciona sin conexión. Los datos se guardan en el teléfono.

## Cuentas y nube (Supabase)

- Registro e inicio de sesión con correo y contraseña.
- Los datos de cada usuario se guardan en la tabla `user_data` y se sincronizan solos.
- La tabla `subscriptions` guarda el plan (gratis / pro). Solo se cambia desde el panel de Supabase.
- Configuración inicial de la base de datos: `supabase/001_inicio.sql` (pegar en SQL Editor y ejecutar).

## Lía con IA (Gemini)

- Función `supabase/functions/lia/index.ts` (Supabase Edge Function). Recibe texto, audio o sílabo (PDF/foto) más el contexto del horario y devuelve acciones en JSON.
- La clave vive en Supabase → Edge Functions → Secrets como `GEMINI_API_KEY`. Opcional: `GEMINI_MODEL` para fijar un modelo.
- Sin conexión, la app usa su lector de frases local como respaldo.

## Próximos pasos

2. Notificaciones antes de cada bloque.
3. Plan Pro y pagos (Yape / Mercado Pago).

## Publicación

Netlify publica la carpeta raíz del repositorio (`netlify.toml`). No hay paso de compilación: cada cambio en `main` se publica solo.
