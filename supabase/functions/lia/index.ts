// LIA · Función "lia" (Supabase Edge Function)
// Recibe lo que el estudiante escribe o dice (o su sílabo) y le pide a Gemini
// que lo convierta en acciones sobre su horario. La clave de Gemini vive en
// los Secrets de Supabase (GEMINI_API_KEY) y nunca llega al celular.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELS = [
  Deno.env.get("GEMINI_MODEL"),
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
].filter(Boolean) as string[];

const SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    reply: { type: "STRING" },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["add_eval", "add_commitment", "block_time", "free_day", "delete_eval", "mark_done"] },
          eval_type: { type: "STRING", enum: ["parcial", "final", "practica", "control", "entrega", "exposicion"] },
          course: { type: "STRING" },
          date: { type: "STRING" },
          time: { type: "STRING" },
          hours: { type: "NUMBER" },
          name: { type: "STRING" },
          kind: { type: "STRING", enum: ["clase", "trabajo", "traslado", "otro"] },
          days: { type: "ARRAY", items: { type: "INTEGER" } },
          start: { type: "STRING" },
          end: { type: "STRING" },
          label: { type: "STRING" },
          minutes: { type: "INTEGER" },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "actions"],
};

function systemPrompt(b: Record<string, string>) {
  return `Eres Lía, la secretaria virtual de LIA, una app para universitarios peruanos que estudian y trabajan.
Hablas en español peruano neutro, cálido y breve (máximo 2 o 3 oraciones). Tuteas. No uses emojis.

Tu trabajo es entender lo que el estudiante dice y convertirlo en acciones sobre su horario.
Organizas TODO lo que ocupa su tiempo, no solo estudio y trabajo: citas médicas, trámites, cumpleaños, viajes,
deporte, familia, salidas, etc. Todo eso cuenta, porque le quita horas libres para estudiar.
El horario de estudio lo calcula un algoritmo de la app: tú NO ubicas bloques de estudio.
Tú registras compromisos, evaluaciones y tiempos ocupados, y respondes preguntas usando el contexto.

FECHA Y HORA: hoy es ${b.weekday} ${b.today}, son las ${b.time} (hora de Lima).
- Convierte "mañana", "el jueves", "el 29", "la próxima semana" a fechas YYYY-MM-DD futuras.
- Horas en formato 24 h HH:MM. Para clases o trabajo, "de 3 a 7" es 15:00 a 19:00.
- "en la mañana" = 09:00-13:00, "en la tarde" = 14:00-18:00, "en la noche" = 19:00-22:00.
- days: 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado.

ACCIONES:
- add_eval: exámenes, prácticas, controles, entregas, exposiciones. Usa eval_type, course, date, time y hours.
  Si no dicen la hora: 09:00 para exámenes y 23:59 para entregas.
  hours = horas de estudio que necesita. Si no lo dicen: parcial 5, final 6, practica 3, control 2, entrega 4, exposicion 3.
- add_commitment: algo que se repite cada semana (clases, trabajo, gimnasio, traslados). Usa name, kind, days, start, end.
- block_time: cualquier cosa puntual que ocupa tiempo un día concreto (cita médica, trámite, cumpleaños, salida, turno extra).
  Usa date, start, end y un label corto y claro (ej. "Cita médica", "Cumpleaños de mamá").
  Si no dice cuánto dura, asume 2 horas para citas y trámites (incluye traslado) y 3 horas para eventos sociales.
  Si no dice a qué hora empieza, NO inventes: pregunta la hora en reply y devuelve actions vacío.
  Ejemplo: "hoy salgo del trabajo a las 9" → bloquea hoy desde la hora en que normalmente termina su trabajo hasta las 21:00.
  Ejemplo: "en 2 días tengo médico a las 4" → block_time de 16:00 a 18:00 en la fecha de dentro de 2 días, label "Cita médica".
- free_day: quiere un día entero libre. Usa date.
- delete_eval: ya no tiene una evaluación (la cancelaron, ya pasó, se equivocó). Usa course.
- mark_done: dice que ya estudió cierto tiempo de un curso. Usa course y minutes.

REGLAS:
- Si falta algo esencial (por ejemplo, la fecha de un examen), no inventes: devuelve actions vacío y pregunta en reply.
- Si es una pregunta ("¿qué tengo mañana?", "¿cuánto me falta?"), responde con el contexto y sin acciones.
- Si te piden consejos para estudiar u organizarse, da uno o dos consejos concretos y breves.
- Si te preguntan algo que no tiene que ver con su tiempo o sus estudios, responde amablemente en una oración y recuerda que puedes ayudarle con su horario.
- Nunca propongas estudiar de madrugada ni quitar horas de sueño: la promesa de LIA es que el estudiante no se amanezca.
- En reply, confirma con tus palabras lo que vas a hacer, en una o dos oraciones.
- Si recibes audio, escribe en transcript exactamente lo que dijo el estudiante.

DATOS DEL ESTUDIANTE:
${b.context}`;
}

const SYLLABUS_TASK = `Este archivo es el sílabo (o una foto del sílabo) de un curso.
Extrae TODAS las evaluaciones que tengan fecha (exámenes, prácticas, controles, entregas, exposiciones) como acciones add_eval.
- course: el nombre del curso tal como aparece en el sílabo.
- Si una evaluación solo dice "semana 8", calcula la fecha si el sílabo indica cuándo empieza el ciclo; si no se puede, omítela y dilo en reply.
- Ignora evaluaciones con fechas que ya pasaron.
En reply, resume cuántas evaluaciones encontraste y de qué curso.`;

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "Falta configurar GEMINI_API_KEY en los Secrets de Supabase." }, 500);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Solicitud inválida" }, 400); }

  const text = String(b.text ?? "").slice(0, 2000);
  const audio = b.audio && typeof b.audio.data === "string" ? b.audio : null;
  const file = b.file && typeof b.file.data === "string" ? b.file : null;
  if ((audio && audio.data.length > 4_000_000) || (file && file.data.length > 7_000_000)) {
    return json({ error: "El archivo es muy grande." }, 413);
  }

  // Historial corto del chat (alternando usuario / Lía, empezando por usuario)
  const contents: { role: string; parts: Part[] }[] = [];
  for (const m of Array.isArray(b.history) ? b.history.slice(-8) : []) {
    const role = m.from === "me" ? "user" : "model";
    const t = String(m.text ?? "").slice(0, 600);
    if (!t) continue;
    if (!contents.length && role === "model") continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += "\n" + t;
    else contents.push({ role, parts: [{ text: t }] });
  }
  if (contents.length && contents[contents.length - 1].role === "user") contents.pop();

  const parts: Part[] = [];
  if (file) {
    parts.push({ text: SYLLABUS_TASK });
    parts.push({ inlineData: { mimeType: String(file.mime || "application/pdf"), data: file.data } });
  } else if (audio) {
    parts.push({ text: "El estudiante te mandó este audio. Transcríbelo en transcript y responde." });
    parts.push({ inlineData: { mimeType: String(audio.mime || "audio/wav"), data: audio.data } });
  } else {
    if (!text.trim()) return json({ error: "Mensaje vacío" }, 400);
    parts.push({ text });
  }
  contents.push({ role: "user", parts });

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt({ ...b, context: String(b.context ?? "").slice(0, 12000) }) }] },
    contents,
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
  };

  let lastStatus = 500, lastError = "";
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      lastStatus = r.status;
      lastError = (await r.text()).slice(0, 400);
      if (r.status === 404 || r.status === 429 || r.status === 503 || (r.status === 400 && /model/i.test(lastError))) continue;
      break;
    }
    const data = await r.json();
    const out = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((p: any) => !p.thought && typeof p.text === "string")
      .map((p: any) => p.text).join("");
    try {
      const parsed = JSON.parse(out);
      if (typeof parsed.reply !== "string") parsed.reply = "";
      if (!Array.isArray(parsed.actions)) parsed.actions = [];
      parsed.model = model;
      return json(parsed);
    } catch {
      lastStatus = 502; lastError = "Respuesta de IA no válida";
    }
  }
  console.error("Gemini falló:", lastStatus, lastError);
  return json({ error: lastStatus === 429 ? "Límite de consultas alcanzado" : "La IA no respondió", detail: lastError }, lastStatus === 429 ? 429 : 502);
});
