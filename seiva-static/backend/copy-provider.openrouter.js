// Generador de copy vía OpenRouter (OpenAI-compatible chat completions).
// Reusa OPENROUTER_API_KEY / OPENROUTER_MODEL ya presentes en el bot.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";

const SYSTEM_PROMPT = `Sos redactor SEO de una tienda de suplementos en Paraguay (Seiva). Vas a recibir datos de un producto y debés generar: título optimizado, descripción corta y descripción larga.

REGLAS ESTRICTAS:
- Solo usá datos que vengan en el producto fuente (nombre, marca, presentación, datos técnicos, precio). NO inventes propiedades medicinales ni beneficios que el producto no declare en su empaque o fuente original.
- Tono confiable y profesional. No prometas resultados médicos ni hagas afirmaciones que suenen a promesa de cura/tratamiento/diagnóstico.
- Adaptá el tono a Paraguay: usá "vos", moneda en guaraníes (Gs.) escrita como número con separador de miles.
- SEO local natural (sin relleno): incluí de forma orgánica frases como "suplementos Paraguay", "[nombre] comprar Paraguay", "envío a todo el país".
- Título: claro, con la keyword principal al inicio.

FORMATO de descripcion_larga (respetá SIEMPRE esta estructura, en HTML con <br> y <b>):
[Encabezado: una frase que dice qué es el producto.]
<b>🔹 Beneficios principales</b>
• (3 a 5 bulletes, uno por línea, beneficio real del producto)
<b>🔹 Modo de uso</b>
(dosis sugerida si aplica, o "Seguí las indicaciones del envase.")
<b>🔹 Ideal para</b>
(público objetivo: quienes buscan energía, recuperación muscular, pérdida de peso, etc.)
[CIERRE corto con llamado a la acción: "Compralo ahora en Seiva y recibilo en tu casa en todo Paraguay."]

Respondé SOLO con JSON válido (sin markdown, sin fences):
{
  "titulo": "...",
  "descripcion_corta": "...",
  "descripcion_larga": "...",
  "seo_keywords": ["palabra1", "palabra2"]
}`;

function buildUserPrompt(d) {
  const dt = d.datos_tecnicos && Object.keys(d.datos_tecnicos).length
    ? "\nDatos técnicos: " + JSON.stringify(d.datos_tecnicos)
    : "";
  return `Producto a redactar:
Nombre: ${d.nombre || ""}
Marca: ${d.marca || ""}
Presentación: ${d.presentacion || ""}
Precio: ${d.precio ? "Gs. " + Number(d.precio).toLocaleString("es-PY") : ""}
Categoría: ${d.categoria || "suplementos"}${dt}`;
}

function parseCopy(content, draft) {
  let json = null;
  try {
    json = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
  } catch (e) {
    // fallback: intentar extraer primer bloque { ... }
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { json = JSON.parse(m[0]); } catch (e2) { json = null; }
    }
  }
  // Si no hay JSON válido, usamos el texto crudo como descripción larga.
  // (modelos free chicos a veces devuelven texto suelto en vez de JSON)
  if (!json) {
    const raw = String(content || "").trim();
    return {
      titulo: (draft.nombre || "Producto").toString().slice(0, 160),
      descripcion_corta: raw.slice(0, 300),
      descripcion_larga: raw || "",
      seo_keywords: [],
      _structure_missing: ["Beneficios principales", "Modo de uso", "Ideal para"],
      _raw_text: true,
    };
  }
  const larg = json.descripcion_larga || "";
  const needs = ["Beneficios principales", "Modo de uso", "Ideal para"];
  const missing = needs.filter(n => !larg.includes(n));
  return {
    titulo: (json.titulo || draft.nombre || "").toString().slice(0, 160),
    descripcion_corta: (json.descripcion_corta || "").toString().slice(0, 300),
    descripcion_larga: larg,
    seo_keywords: Array.isArray(json.seo_keywords) ? json.seo_keywords : [],
    _structure_missing: missing,
  };
}

async function callOpenRouter(messages, useJsonMode, mergeSystem) {
  let msgs = messages;
  if (mergeSystem) {
    // Algunos modelos free no aceptan rol "system": lo fusionamos en el primer user message.
    const sys = messages.find(m => m.role === "system");
    const usr = messages.find(m => m.role === "user");
    msgs = [{ role: "user", content: (sys ? sys.content + "\n\n" : "") + (usr ? usr.content : "") }];
  }
  const body = { model: OPENROUTER_MODEL, messages: msgs, temperature: 0.7 };
  if (useJsonMode) body.response_format = { type: "json_object" };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.PUBLIC_BASE_URL || "https://seiva.com.py",
      "X-Title": "Seiva Product Wizard",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) return { ok: false, error: data.error?.message || "OpenRouter error" };
  return { ok: true, content: data.choices[0].message.content };
}

async function generateCopy(draft) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY no configurada");
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(draft) },
  ];
  // Intento 1: JSON mode estricto (OpenAI/Gemini lo soportan).
  let r = await callOpenRouter(messages, true, false);
  // Intento 2: sin JSON mode (algunos modelos free lo rechazan).
  if (!r.ok) r = await callOpenRouter(messages, false, false);
  // Intento 3: sin JSON mode y fusionando system+user (modelos que no aceptan rol system).
  if (!r.ok) r = await callOpenRouter(messages, false, true);
  if (!r.ok) throw new Error(r.error);
  return parseCopy(r.content, draft);
}

module.exports = { generateCopy };
