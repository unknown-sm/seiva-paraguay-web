// Proveedor CUSTOM de generación de copy.
// Reemplazá generateCopy con tu propia lógica (otro LLM, plantillas fijas, etc.).
// El objeto `draft` trae: { nombre, marca, presentacion, precio, categoria, datos_tecnicos }
// Debés devolver: { titulo, descripcion_corta, descripcion_larga, seo_keywords[] }

async function generateCopy(draft) {
  // TODO: tu implementación.
  // Ejemplo mínimo (borrar y reemplazar):
  const titulo = `${draft.nombre || "Producto"} ${draft.marca || ""}`.trim();
  return {
    titulo,
    descripcion_corta: `${draft.nombre || "Producto"} de ${draft.marca || "alta calidad"} en Seiva. Suplementos Paraguay, envío a todo el país.`,
    descripcion_larga: `<b>🔹 Beneficios principales</b><br>• Calidad premium<br><b>🔹 Modo de uso</b><br>Seguí las indicaciones del envase.<br><b>🔹 Ideal para</b><br>Quienes buscan suplementación de confianza.`,
    seo_keywords: [draft.nombre, "suplementos Paraguay"],
  };
}

module.exports = { generateCopy };
