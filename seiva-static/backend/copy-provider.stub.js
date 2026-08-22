// Proveedor STUB: devuelve plantilla local sin llamar a ninguna IA.
// Útil para desarrollo/tests cuando no querés gastar tokens.

async function generateCopy(draft) {
  const nombre = draft.nombre || "Producto";
  const marca = draft.marca || "";
  const precio = draft.precio ? "Gs. " + Number(draft.precio).toLocaleString("es-PY") : "consultar";
  const titulo = `${nombre} ${marca}`.trim();
  const descripcion_corta = `${nombre} de ${marca || "alta calidad"} en Seiva. Suplementos Paraguay, envío a todo el país.`.slice(0, 300);
  const descripcion_larga =
    `${nombre} es un suplemento de calidad premium para tu rutina.<br>` +
    `<b>🔹 Beneficios principales</b><br>` +
    `• Calidad y pureza certificada<br>` +
    `• Formato práctico y fácil de llevar<br>` +
    `• Ideal para complementar tu alimentación<br>` +
    `<b>🔹 Modo de uso</b><br>Seguí las indicaciones del envase.<br>` +
    `<b>🔹 Ideal para</b><br>Quienes buscan suplementación confiable en Paraguay.<br>` +
    `Compralo ahora en Seiva y recibilo en tu casa en todo el país.`;
  return {
    titulo: titulo.slice(0, 160),
    descripcion_corta,
    descripcion_larga,
    seo_keywords: [nombre, "suplementos Paraguay", `${nombre} comprar Paraguay`],
  };
}

module.exports = { generateCopy };
