// Plantillas específicas por tipo de producto. Cuando la IA devuelve algo genérico
// (palabras clave como "Suplemento nutricional formulado con ingredientes de calidad",
// "Producto natural de alta calidad"), se descarta y se usa una plantilla real
// extraída del nombre del producto.

const FICHAS = [
  {
    match: [/magnesio|magnesios|magnes\b/i],
    beneficios_cortos: [
      '⚡ Apoya la función muscular y reduce calambres.',
      '💪 Contribuye a huesos y dientes fuertes.',
      '😌 Favorece la relajación y un mejor descanso.',
      '❤️ Apoya el ritmo cardíaco y el sistema nervioso.',
      '🏋️ Favorece el rendimiento físico y la recuperación.'
    ],
    intro: 'Magnesio en alta biodisponibilidad, ideal para cubrir necesidades diarias y acompañar la rutina de entrenamiento, trabajo o estudio.',
    ingredientes: 'Bisglicinato/citrato/treonato de magnesio (según el producto), agentes de carga (celulosa microcristalina), cápsula de gelatina vegetal.',
    uso: 'Consumir 2 cápsulas al día, preferentemente con las comidas.',
    publico: 'adultos mayores de 18 años que buscan apoyo para músculos, sistema nervioso y descanso',
    meta_beneficio: 'músculos, descanso y energía'
  },
  {
    match: [/vitamina\s*c|vit\s*c/i],
    beneficios_cortos: [
      '🛡️ Refuerza el sistema inmunológico.',
      '✨ Contribuye a la producción natural de colágeno.',
      '💪 Mejora la absorción del hierro de los alimentos.',
      '🧬 Potente antioxidante que protege las células.',
      '⚡ Apoya la energía y reduce el cansancio.'
    ],
    intro: 'Vitamina C esencial para defensas, piel y energía. Aporta el soporte diario que el cuerpo necesita para funcionar al máximo.',
    ingredientes: 'Ácido ascórbico (vitamina C), cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con el desayuno.',
    publico: 'adultos mayores de 18 años que buscan reforzar defensas y cuidar la piel',
    meta_beneficio: 'defensas, piel y energía'
  },
  {
    match: [/col[aá]geno/i],
    beneficios_cortos: [
      '✨ Mejora la elasticidad y firmeza de la piel.',
      '💅 Fortalece cabello y uñas.',
      '🦴 Apoya la salud de articulaciones y cartílagos.',
      '🧬 Contribuye a la regeneración natural del colágeno.',
      '⚡ Favorece la recuperación después del ejercicio.'
    ],
    intro: 'Colágeno hidrolizado de alta absorción para apoyar la piel, las articulaciones y la vitalidad desde adentro.',
    ingredientes: 'Colágeno hidrolizado, vitamina C (para mejorar la absorción), cápsula vegetal.',
    uso: 'Consumir 2 cápsulas al día con un vaso de agua, idealmente en ayunas.',
    publico: 'adultos mayores de 25 años preocupados por piel, cabello y articulaciones',
    meta_beneficio: 'piel, articulaciones y vitalidad'
  },
  {
    match: [/omega\s*3|omega\s*3-6-9/i],
    beneficios_cortos: [
      '❤️ Apoya la salud cardiovascular.',
      '🧠 Mejora la función cerebral y la memoria.',
      '🛡️ Reduce la inflamación en el cuerpo.',
      '✨ Beneficia la piel y el cabello.',
      '💪 Mantiene niveles saludables de triglicéridos.'
    ],
    intro: 'Omega 3 de calidad para cuidar el corazón, el cerebro y mantener una inflamación saludable.',
    ingredientes: 'Aceite de pescado rico en EPA y DHA (o fuente vegetal para veganos), cápsula de gelatina.',
    uso: 'Consumir 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años que buscan cuidar corazón, cerebro y piel',
    meta_beneficio: 'corazón, cerebro y piel'
  },
  {
    match: [/vitamina\s*d|vit\s*d|colecalciferol|d3/i],
    beneficios_cortos: [
      '🦴 Promueve la absorción de calcio para huesos fuertes.',
      '🛡️ Fortalece el sistema inmunológico.',
      '❤️ Apoya la salud cardiovascular y muscular.',
      '⚙️ Contribuye al metabolismo normal del calcio.',
      '🧠 Apoya la función muscular y mental.'
    ],
    intro: 'Vitamina D3 esencial para huesos, defensas y energía. Especialmente útil en climas donde la exposición solar es limitada.',
    ingredientes: 'Colecalciferol (vitamina D3), aceite portador (generalmente oliva o coco), cápsula de gelatina.',
    uso: 'Consumir 1 cápsula al día, preferentemente con una comida grasa para mejor absorción.',
    publico: 'adultos mayores de 18 años con baja exposición solar',
    meta_beneficio: 'huesos, defensas y energía'
  },
  {
    match: [/ashwagandha/i],
    beneficios_cortos: [
      '😌 Reduce el estrés y la ansiedad del día a día.',
      '😴 Mejora la calidad del sueño.',
      '⚡ Aumenta la energía y resistencia física.',
      '⚖️ Equilibra los niveles hormonales naturalmente.',
      '🧠 Apoya la claridad mental y la concentración.'
    ],
    intro: 'Ashwagandha, una de las plantas más estudiadas de la Ayurveda, ideal para manejar el estrés y recuperar energía.',
    ingredientes: 'Extracto de raíz de Ashwagandha (Withania somnifera), cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día con el desayuno o la cena.',
    publico: 'adultos mayores de 18 años bajo estrés o con cansancio persistente',
    meta_beneficio: 'estrés, energía y descanso'
  },
  {
    match: [/probio|intestinal|flora/i],
    beneficios_cortos: [
      '⚖️ Equilibra la flora intestinal.',
      '🛡️ Refuerza el sistema inmunológico.',
      '🍽️ Mejora la digestión y reduce la hinchazón.',
      '💪 Favorece la absorción de nutrientes.',
      '🌿 Apoya la salud intestinal a largo plazo.'
    ],
    intro: 'Probióticos de alta potencia para restablecer y mantener una flora intestinal saludable.',
    ingredientes: 'Mezcla de cepas probióticas (Lactobacillus, Bifidobacterium), cápsula vegetal gastrorresistente.',
    uso: 'Consumir 1 cápsula al día en ayunas o antes de dormir.',
    publico: 'adultos mayores de 18 años con problemas digestivos o que tomaron antibióticos',
    meta_beneficio: 'digestión, defensas y flora'
  },
  {
    match: [/vitamina\s*b|complejo\s*b|tiamina|riboflavina|niacina|b12/i],
    beneficios_cortos: [
      '⚡ Apoya el metabolismo energético y reduce el cansancio.',
      '🧠 Contribuye al funcionamiento del sistema nervioso.',
      '❤️ Favorece la salud cardiovascular.',
      '✨ Mejora la piel, el cabello y las uñas.',
      '😌 Apoya el equilibrio emocional y reduce el estrés.'
    ],
    intro: 'Vitaminas del grupo B para transformar los alimentos en energía y cuidar el sistema nervioso.',
    ingredientes: 'Complejo B (B1, B2, B3, B5, B6, B7, B9, B12), cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con el desayuno.',
    publico: 'adultos mayores de 18 años con cansancio o estrés',
    meta_beneficio: 'energía, nervios y metabolismo'
  },
  {
    match: [/c[uú]rcuma|curcumina/i],
    beneficios_cortos: [
      '🛡️ Potente antiinflamatorio y antioxidante natural.',
      '🦴 Alivia molestias articulares y musculares.',
      '🍽️ Favorece la digestión y la función hepática.',
      '❤️ Apoya la salud cardiovascular.',
      '🧬 Protege las células del estrés oxidativo.'
    ],
    intro: 'Cúrcuma con pimienta negra para una absorción hasta 20 veces mayor, una de las especias más estudiadas por sus beneficios.',
    ingredientes: 'Extracto de cúrcuma (95% curcuminoides), pimienta negra (piperina), cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años con inflamación o molestias articulares',
    meta_beneficio: 'inflamación y articulaciones'
  },
  {
    match: [/calostro/i],
    beneficios_cortos: [
      '🛡️ Refuerza el sistema inmunológico.',
      '💪 Favorece el crecimiento y la recuperación muscular.',
      '🍽️ Apoya la salud intestinal y la digestión.',
      '♻️ Contribuye a la reparación celular.',
      '⚡ Mejora el bienestar general y la vitalidad.'
    ],
    intro: 'Calostro bovino, el primer alimento de la naturaleza, rico en anticuerpos y factores de crecimiento.',
    ingredientes: 'Calostro bovino liofilizado, cápsula de gelatina.',
    uso: 'Consumir 2 cápsulas al día en ayunas.',
    publico: 'adultos mayores de 18 años que buscan reforzar defensas y recuperación',
    meta_beneficio: 'defensas y recuperación'
  },
  {
    match: [/ginkgo|ginko/i],
    beneficios_cortos: [
      '🧠 Mejora la memoria y la concentración.',
      '🩸 Estimula la circulación sanguínea.',
      '⚡ Potencia el rendimiento físico y mental.',
      '😌 Reduce el estrés y la fatiga.',
      '🛡️ Protege las células del daño oxidativo.'
    ],
    intro: 'Ginkgo Biloba, una de las plantas más antiguas del mundo, aliada de la claridad mental y la circulación.',
    ingredientes: 'Extracto de hojas de Ginkgo Biloba (24% flavonoids, 6% lactonas), cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con el desayuno.',
    publico: 'adultos mayores de 18 años que buscan foco y circulación',
    meta_beneficio: 'memoria y circulación'
  },
  {
    match: [/berberina/i],
    beneficios_cortos: [
      '🩸 Ayuda a regular los niveles de azúcar en sangre.',
      '❤️ Apoya la salud cardiovascular y el colesterol.',
      '⚖️ Contribuye al control del peso y el metabolismo.',
      '🛡️ Refuerza el sistema inmunológico.',
      '🌿 Favorece la salud digestiva.'
    ],
    intro: 'Berberina, un alcaloide natural extraído de plantas, conocida por su efecto sobre el metabolismo y la glucosa.',
    ingredientes: 'Clorhidrato de berberina, cápsula vegetal.',
    uso: 'Consumir 2 cápsulas al día, una antes del almuerzo y otra antes de la cena.',
    publico: 'adultos mayores de 18 años que buscan regular el azúcar y el colesterol',
    meta_beneficio: 'azúcar, colesterol y metabolismo'
  },
  {
    match: [/resveratrol/i],
    beneficios_cortos: [
      '🛡️ Potente acción antioxidante contra el envejecimiento celular.',
      '❤️ Apoya la salud cardiovascular.',
      '🧬 Promueve la longevidad celular.',
      '🧠 Favorece la salud cerebral y la función cognitiva.',
      '🩸 Mantiene niveles saludables de glucosa en sangre.'
    ],
    intro: 'Resveratrol, el antioxidante del vino tinto y la uva, para cuidar la salud cardiovascular y el envejecimiento.',
    ingredientes: 'Trans-Resveratrol (de Polygonum cuspidatum o uva), cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con una comida.',
    publico: 'adultos mayores de 18 años que buscan antioxidantes y salud cardiovascular',
    meta_beneficio: 'antioxidante y longevidad'
  },
  {
    match: [/creatina/i],
    beneficios_cortos: [
      '💪 Aumenta la fuerza y potencia muscular.',
      '🏋️ Mejora el rendimiento físico y la resistencia.',
      '♻️ Acelera la recuperación después del entrenamiento.',
      '🧠 Apoya la función cerebral bajo esfuerzo.',
      '✓ Recomendada por estudios científicos como segura y efectiva.'
    ],
    intro: 'Creatina monohidrato, el suplemento deportivo más estudiado del mundo, ideal para fuerza y rendimiento.',
    ingredientes: 'Creatina monohidrato micronizada (200 mesh).',
    uso: 'Consumir 3 a 5 g al día, preferentemente después del entrenamiento.',
    publico: 'adultos mayores de 18 años que entrenan fuerza o quieren mejorar rendimiento',
    meta_beneficio: 'fuerza y rendimiento'
  },
  {
    match: [/tongkat|tongkat\s*ali|eurycoma|shilajit/i],
    beneficios_cortos: [
      '⚡ Aumenta la energía y la vitalidad.',
      '💪 Favorece la fuerza muscular y la resistencia.',
      '⚖️ Equilibra las hormonas masculinas naturalmente.',
      '🧠 Apoya la concentración y el enfoque mental.',
      '❤️ Contribuye a la salud sexual y la libido.'
    ],
    intro: 'Tongkat Ali, una raíz tradicionalmente usada en Asia para mejorar energía, vitalidad y rendimiento físico.',
    ingredientes: 'Extracto de raíz de Eurycoma longifolia (100:1), cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años que buscan energía y vitalidad',
    meta_beneficio: 'energía, fuerza y vitalidad'
  },
  {
    match: [/nac|n[-\s]?acetilciste[ií]na/i],
    beneficios_cortos: [
      '🫁 Apoya la salud respiratoria y descongestiona.',
      '🛡️ Refuerza el sistema inmunológico.',
      '🧬 Aumenta los niveles de glutatión, antioxidante maestro.',
      '🍽️ Apoya la detoxificación del hígado.',
      '🧠 Protege la salud cerebral y cognitiva.'
    ],
    intro: 'NAC (N-Acetilcisteína), un precursor del glutatión, el antioxidante más importante del cuerpo.',
    ingredientes: 'N-Acetilcisteína, cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día, preferentemente en ayunas.',
    publico: 'adultos mayores de 18 años que buscan detox, defensas y pulmones',
    meta_beneficio: 'detox y antioxidantes'
  },
  {
    match: [/hongo|reishi|mushroom/i],
    beneficios_cortos: [
      '🛡️ Refuerza el sistema inmunológico.',
      '😌 Reduce el estrés y favorece la relajación.',
      '😴 Mejora la calidad del sueño.',
      '♻️ Antioxidante natural que combate el envejecimiento.',
      '❤️ Apoya la salud cardiovascular.'
    ],
    intro: 'Hongos medicinales utilizados durante siglos por la medicina tradicional china por sus propiedades inmunoestimulantes.',
    ingredientes: 'Mezcla de extractos de hongos (Reishi, Maitake, Cordyceps según el producto), cápsula vegetal.',
    uso: 'Consumir 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años que buscan defensas y equilibrio',
    meta_beneficio: 'inmunidad y equilibrio'
  },
  {
    match: [/zinc|zn/i],
    beneficios_cortos: [
      '🛡️ Refuerza el sistema inmunológico.',
      '💅 Favorece la piel, el cabello y las uñas.',
      '♻️ Apoya la cicatrización y la recuperación.',
      '⚖️ Contribuye al equilibrio hormonal.',
      '🧬 Esencial para la síntesis de proteínas.'
    ],
    intro: 'Zinc, mineral esencial presente en más de 300 enzimas del cuerpo, vital para defensas, piel y hormonas.',
    ingredientes: 'Quelato de zinc o gluconato de zinc, cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con una comida.',
    publico: 'adultos mayores de 18 años con defensas bajas o piel/cabello deteriorado',
    meta_beneficio: 'defensas, piel y hormonas'
  },
  {
    match: [/potasio/i],
    beneficios_cortos: [
      '❤️ Promueve la salud cardiovascular.',
      '🩸 Regula la presión arterial.',
      '💪 Mejora la función muscular y evita calambres.',
      '⚡ Mantiene el equilibrio de electrolitos.',
      '🧠 Apoya la transmisión nerviosa.'
    ],
    intro: 'Potasio, mineral esencial para músculos, corazón y equilibrio de líquidos en el cuerpo.',
    ingredientes: 'Citrato de potasio o gluconato de potasio, cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años con calambres o que consumen poco potasio',
    meta_beneficio: 'corazón y músculos'
  },
  {
    match: [/selenio/i],
    beneficios_cortos: [
      '🛡️ Potente antioxidante que protege las células.',
      '❤️ Apoya la salud cardiovascular.',
      '🧬 Contribuye a la función tiroidea.',
      '🛡️ Refuerza el sistema inmunológico.',
      '⚖️ Favorece el equilibrio hormonal.'
    ],
    intro: 'Selenio, mineral traza esencial para la tiroides y la defensa antioxidante del cuerpo.',
    ingredientes: 'Selenio quelado o selenometionina, cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con el desayuno.',
    publico: 'adultos mayores de 18 años que buscan antioxidantes y salud tiroidea',
    meta_beneficio: 'tiroides y antioxidantes'
  },
  {
    match: [/maca/i],
    beneficios_cortos: [
      '⚡ Aumenta la energía y la resistencia física.',
      '😌 Mejora el estado de ánimo.',
      '⚖️ Equilibra las hormonas naturalmente.',
      '❤️ Favorece la fertilidad y la libido.',
      '🧠 Estimula la función cognitiva.'
    ],
    intro: 'Maca peruana, raíz andina con siglos de uso tradicional para energía, equilibrio hormonal y vitalidad.',
    ingredientes: 'Extracto de raíz de maca (Lepidium meyenii), cápsula vegetal.',
    uso: 'Consumir 2 cápsulas al día con el desayuno.',
    publico: 'adultos mayores de 18 años con cansancio o desequilibrio hormonal',
    meta_beneficio: 'energía y equilibrio'
  }
];

// Función: detecta qué tipo de producto es según el nombre.
// Devuelve la primera ficha que matchea todas las regex de `match`.
function fichaPorNombre(nombre) {
  if (!nombre) return null;
  for (const f of FICHAS) {
    let all = true;
    for (const rx of f.match) {
      if (!rx.test(nombre)) { all = false; break; }
    }
    if (all) return f;
  }
  return null;
}

// Genera una ficha completa usando la plantilla específica del producto.
function fichaEspecifica(nombre, marca) {
  const plantilla = fichaPorNombre(nombre);
  if (!plantilla) return null;
  // Extraer un nombre amigable: "10 magnesios 120 capsulas 500mg UE - UniErvas"
  // → "10 Magnesios". Para títulos cortos, usamos una versión limpia.
  const nombreLimpio = (nombre || 'Este producto')
    .replace(/\s*[-–]\s*\d+\s*c[aá]psulas?.*$/i, '')
    .replace(/\s+\d+(capsulas|c[aá]psulas)(.*)?$/i, '')
    .replace(/\s+\d+\s*(mg|ml|g|gr|UI|ui|mcg|lb|kg)\b.*$/i, '')
    .replace(/\s+(UE|MX|UL|AP|FL|BIO|NB|RY|UN|CO|EX|PR|FNB|KT|SW|VC|AL|KN|VE|RX)\s*$/i, '')
    .replace(/\s+\d+\s*(lb|kg|g|ml)\b.*$/i, '')
    .replace(/\s*-\s*$/i, '')
    .trim() || 'Este producto';
  const nombreTitulo = (nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1));
  const marcaTxt = marca ? ' de ' + marca : '';
  const titulo = nombreTitulo + (marca ? ' - ' + marca : '');
  const ingredientes = plantilla.ingredientes || 'Ingredientes activos según el producto.';
  const descCorta = 'Beneficios principales<br>' + plantilla.beneficios_cortos.join('<br>');
  const descLarga = '<p>' + nombreTitulo + marcaTxt + '. ' + plantilla.intro + '</p>\n\n' +
    '<h3>Ingredientes</h3>\n<p>' + ingredientes + '</p>\n\n' +
    '<p>✅ Sin gluten.</p>\n\n' +
    '<h3>Modo de uso</h3>\n<p>' + plantilla.uso + '</p>\n<p>Indicado para ' + plantilla.publico + '.</p>\n\n' +
    '<h3>Importante</h3>\n<p>Este producto es un suplemento alimenticio y no un medicamento. No exceder la cantidad recomendada. Mantener fuera del alcance de los niños y conservar en un lugar fresco, seco y protegido de la luz.</p>';
  // meta_titulo: max 60 chars
  const cabeza = nombreTitulo.slice(0, 50);
  const metaTitulo = (cabeza + ' | ' + plantilla.meta_beneficio).slice(0, 70);
  // Primer beneficio, sin emoji al inicio
  const primerBen = plantilla.beneficios_cortos[0].replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+\s*/, '');
  const metaDesc = (nombreTitulo + ' con ' + ingredientes.split(',')[0].trim().toLowerCase() + '. ' + primerBen + ' Suplemento nutricional en Paraguay.').slice(0, 160);
  return {
    titulo: titulo,
    descripcion_corta: descCorta,
    descripcion_larga: descLarga,
    meta_titulo: metaTitulo,
    meta_descripcion: metaDesc
  };
}

// Detecta si una descripción_devuelta_por_IA es "genérica" (no específica del producto).
// Si matchea alguna palabra clave genérica, devuelve true — el caller debería
// descartarla y usar fichaEspecifica.
function esGenerica(texto, nombre) {
  if (!texto) return true;
  const frasesGenericas = [
    'suplemento nutricional formulado con ingredientes de calidad',
    'producto natural de alta calidad',
    'aporta nutrientes esenciales para el día a día',
    'calidad garantizada por',
    'apoyo nutricional para adultos mayores'
  ];
  const lower = texto.toLowerCase();
  for (const fg of frasesGenericas) {
    if (lower.includes(fg)) return true;
  }
  // Si menciona el nombre del producto y tiene > 200 chars, probablemente no es genérico.
  if (nombre) {
    const palabraClave = nombre.toLowerCase().split(/\s+/)[0]; // primera palabra
    if (palabraClave && palabraClave.length > 3 && lower.includes(palabraClave)) {
      return false; // HAY indicios específicos.
    }
  }
  return false;
}

module.exports = { fichaEspecifica, fichaPorNombre, esGenerica, FICHAS };
