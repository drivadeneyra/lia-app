# LIA · Tu secretaria para estudiar

App web instalable (PWA) para universitarios que estudian y trabajan: registra tu horario fijo y tus evaluaciones, y LIA reparte tus horas de estudio en tus horas libres reales, sin tocar tu trabajo, tus clases ni tu sueño.

## Estado actual (v0.1)

- Registro de horario fijo y evaluaciones (a mano, escrito o dictado por voz).
- Motor de horarios: reparte las horas de estudio antes de cada evaluación.
- Vistas Hoy, Semana, Lía (chat), Evaluaciones y Perfil.
- Sesión de estudio con temporizador.
- Instalable en Android (Chrome → Instalar app) y iPhone (Safari → Compartir → Agregar a inicio).
- Funciona sin conexión. Los datos se guardan en el teléfono.

## Próximos pasos

1. Cuentas de usuario y datos en la nube (Supabase).
2. Lía con IA (Gemini) y lectura de sílabos en PDF.
3. Notificaciones antes de cada bloque.
4. Plan Pro y pagos (Yape / Mercado Pago).

## Publicación

Netlify publica la carpeta raíz del repositorio (`netlify.toml`). No hay paso de compilación: cada cambio en `main` se publica solo.
