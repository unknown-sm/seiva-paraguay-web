const fs = require('fs');
const https = require('https');
const K = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[1].trim();
const JWT = fs.readFileSync('C:/Users/salaz/AppData/Local/Temp/jwt.txt', 'utf8').trim();
const TOKEN = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[4].trim();

const API = 'https://seiva.com.py/api/productos';
const CRED_HTTP = { httpHeaderAuth: { id: '07NLMVgZ0MQtdNGA', name: 'SEIVA Backend API' } };
const CRED_OR = { openRouterApi: { id: '36xo8T9UglAHMFDT', name: 'OpenRouter account' } };
const CRED_TG = { telegramApi: { id: 'wtekAWcrcfSlrW67', name: 'SEIVA Bot' } };

const SYS = [
  'Eres el asistente de inventario de SEIVA (suplementos, Paraguay, moneda Gs.).',
  'Recibes el mensaje del usuario Y el inventario actual con IDs reales.',
  '',
  'TU UNICA SALIDA ES UN JSON. No escribas texto adicional, no expliques, no uses markdown.',
  '',
  'FORMATO:',
  '{"accion":"<ACCION>","id":<numero>,"valor":<numero>,"datos":{...},"respuesta":"<texto para el usuario>"}',
  '',
  'ACCIONES POSIBLES:',
  '- "consultar": el usuario pregunta algo del inventario. Responde en "respuesta" usando los datos reales del inventario.',
  '- "ajustar_stock": cambiar stock. "id" = ID real, "valor" = stock absoluto nuevo.',
  '- "publicar": poner activo. "id" = ID real.',
  '- "despublicar": quitar activo. "id" = ID real.',
  '- "editar": cambiar precio u otros campos. "id" = ID real, "datos" = {campo: valor}.',
  '- "crear": crear producto nuevo. "datos" = objeto con titulo, slug, descripcion_corta, descripcion_larga, meta_titulo, meta_descripcion, keywords, categoria, sku, precio_venta_pyg, stock, imagen_principal_url, galeria_urls.',
  '- "aclarar": hay ambiguedad o faltan datos. Explica en "respuesta" y pregunta.',
  '- "error": no entendiste. Pregunta en "respuesta".',
  '',
  'REGLAS:',
  '- Usa los IDs del inventario. NUNCA los inventes.',
  '- Si el nombre coincide con VARIOS productos, usa accion "aclarar" y lista los candidatos numerados con sus IDs.',
  '- Si faltan datos (precio, stock), usa accion "aclarar" y pregunta.',
  '- Para "crear", arma la ficha con este formato:',
  '  titulo: "{Nombre} {presentacion} - {Marca}"',
  '  descripcion_corta: "Beneficios principales" y una linea por beneficio con emoji (ej: "[emoji] Apoya la energia.").',
  '  descripcion_larga: parrafo descriptivo, luego "Ingredientes" (lista), "Modo de uso", y "Importante" (texto legal: Este producto es un suplemento alimenticio y no un medicamento...). Sin bloque SEO.',
  '  meta_titulo: "{Nombre} {presentacion} | {beneficio principal}"',
  '  meta_descripcion: "{Nombre} con {ingredientes}. {beneficios}. Suplemento nutricional en Paraguay."',
  '- Para "crear" SIEMPRE pon el texto de confirmacion en "respuesta" (resumen + "Responde APROBAR para crear").',
  '',
  'EJEMPLOS:',
  'Usuario: "actualiza el colostro a 5" (hay 3 colostros) ->',
  '{"accion":"aclarar","respuesta":"Encontre 3 productos con colostro:\\n1. ID 188 - Colostro Bovino 500mg 60 Caps (stock 6)\\n2. ID 190 - Colostro Bovino 500mg 120 Caps (stock 3)\\nCual queres actualizar? Decime el numero o ID."}',
  '',
  'Usuario: "pon el 188 en 5" ->',
  '{"accion":"ajustar_stock","id":188,"valor":5,"respuesta":"Actualizando el stock del producto 188 a 5 unidades."}'
].join('\n');

const nodes = [
  {
    parameters: { updates: ['message', 'callback_query'], additionalFields: {} },
    id: 'tg', name: 'Telegram Trigger', type: 'n8n-nodes-base.telegramTrigger',
    typeVersion: 1.2, position: [-600, 300], credentials: CRED_TG,
    webhookId: 'seiva-agent-v2'
  },
  {
    parameters: {
      url: 'https://seiva.com.py/api/productos/all',
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', options: {}
    },
    id: 'h_inv', name: 'Cargar inventario', type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2, position: [-380, 300], credentials: CRED_HTTP
  },
  {
    parameters: {
      jsCode: [
        "const m = $('Telegram Trigger').item.json.message || $('Telegram Trigger').item.json.callback_query.message;",
        "const cid = m.chat.id;",
        "let txt = m.text || m.caption || '';",
        "const prods = $items('Cargar inventario');",
        "const lineas = prods.map(p => { const j = p.json || p;",
        "  return 'ID ' + j.id + ' | ' + j.nombre + ' | stock:' + j.stock + ' | precio:' + j.precio + ' | ' + (j.activo ? 'publicado' : 'oculto'); });",
        "const inv = lineas.join('\\n');",
        "return [{ json: { chatId: cid, sessionId: cid, mensaje: txt, inventario: inv } }];"
      ].join('\n')
    },
    id: 'prep', name: 'Preparar entrada', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-160, 300]
  },
  {
    parameters: { model: 'xiaomi/mimo-v2.5', options: { systemMessage: SYS } },
    id: 'model', name: 'OpenRouter Chat Model', type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter',
    typeVersion: 1, position: [-160, 520], credentials: CRED_OR
  },
  {
    parameters: { sessionIdType: 'customKey', sessionKey: '={{ $json.sessionId }}', contextWindowLength: 8 },
    id: 'mem', name: 'Memoria (chat)', type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
    typeVersion: 1.4, position: [60, 520]
  },
  {
    parameters: {
      promptType: 'define',
      text: '={{ "MENSAJE: " + $json.mensaje + "\\n\\nINVENTARIO (IDs reales):\\n" + $json.inventario }}',
      options: {}
    },
    id: 'agent', name: 'Agente Inventario', type: '@n8n/n8n-nodes-langchain.agent',
    typeVersion: 3.1, position: [60, 300]
  },
  {
    parameters: {
      jsCode: [
        "let out = $input.first().json.output || $input.first().json.text || '';",
        "out = String(out).trim();",
        "out = out.replace(/^```json\\s*/i, '').replace(/^```\\s*/, '').replace(/```\\s*$/, '').trim();",
        "let d = {};",
        "try { d = JSON.parse(out); } catch (e) { d = { accion: 'error', respuesta: 'No pude interpretar la respuesta. Intenta de nuevo.' }; }",
        "return [{ json: { accion: d.accion || 'error', id: d.id, valor: d.valor, datos: d.datos || {}, respuesta: d.respuesta || '', chatId: $('Preparar entrada').item.json.chatId } }];"
      ].join('\n')
    },
    id: 'parse', name: 'Parsear accion', type: 'n8n-nodes-base.code', typeVersion: 2, position: [280, 300]
  },
  {
    parameters: {
      rules: {
        rules: [
          { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.accion }}', rightValue: 'ajustar_stock', operator: { type: 'equals' } }], combinator: 'and' }, outputKey: 'stock' },
          { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.accion }}', rightValue: 'publicar', operator: { type: 'equals' } }], combinator: 'and' }, outputKey: 'publicar' },
          { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.accion }}', rightValue: 'despublicar', operator: { type: 'equals' } }], combinator: 'and' }, outputKey: 'despublicar' },
          { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.accion }}', rightValue: 'editar', operator: { type: 'equals' } }], combinator: 'and' }, outputKey: 'editar' },
          { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.accion }}', rightValue: 'crear', operator: { type: 'equals' } }], combinator: 'and' }, outputKey: 'crear' }
        ]
      },
      options: { fallbackOutput: 'extra' }
    },
    id: 'sw', name: 'Switch', type: 'n8n-nodes-base.switch', typeVersion: 3.2, position: [500, 300]
  }
];

const actionNode = (name, method, url, body, pos, outputKey) => ({
  parameters: {
    method, url,
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    sendBody: !!body,
    ...(body ? { specifyBody: 'json', jsonBody: body } : {}),
    options: {}
  },
  id: 'act_' + outputKey, name, type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2, position: pos, credentials: CRED_HTTP
});

nodes.push(actionNode('PUT stock', 'PUT', '=' + API + '/{{ $json.id }}', '={{ JSON.stringify({ stock: Number($json.valor) }) }}', [740, 100], 'stock'));
nodes.push(actionNode('PATCH publicar', 'PATCH', '=' + API + '/{{ $json.id }}/toggle', null, [740, 260], 'publicar'));
nodes.push(actionNode('PATCH despublicar', 'PATCH', '=' + API + '/{{ $json.id }}/toggle', null, [740, 420], 'despublicar'));
nodes.push(actionNode('PUT editar', 'PUT', '=' + API + '/{{ $json.id }}', '={{ JSON.stringify($json.datos) }}', [740, 580], 'editar'));
nodes.push(actionNode('POST crear', 'POST', '=' + API, '={{ JSON.stringify($json.datos) }}', [740, 740], 'crear'));

nodes.push({
  parameters: {
    jsCode: [
      "const inEnv = $input.first();",
      "let ok = false;",
      "let detalle = '';",
      "try {",
      "  const r = inEnv.json;",
      "  ok = true;",
      "  detalle = typeof r === 'string' ? r : JSON.stringify(r);",
      "} catch (e) { detalle = 'sin datos'; }",
      "const prev = $('Parsear accion').item.json;",
      "let msg = prev.respuesta || '';",
      "const acc = prev.accion;",
      "if (acc === 'ajustar_stock') msg = (ok ? 'Stock actualizado correctamente.\\n' : 'No pude actualizar el stock.\\n') + msg;",
      "if (acc === 'publicar' || acc === 'despublicar') msg = (ok ? 'Estado actualizado correctamente.\\n' : 'No pude cambiar el estado.\\n') + msg;",
      "if (acc === 'editar') msg = (ok ? 'Producto editado correctamente.\\n' : 'No pude editar el producto.\\n') + msg;",
      "if (acc === 'crear') msg = (ok ? 'Producto creado correctamente.\\n' : 'No pude crear el producto.\\n') + msg;",
      "return [{ json: { chatId: prev.chatId, texto: msg } }];"
    ].join('\n')
  },
  id: 'arm', name: 'Armar respuesta', type: 'n8n-nodes-base.code', typeVersion: 2, position: [980, 300]
});

nodes.push({
  parameters: {
    chatId: '={{ $json.chatId }}',
    text: '={{ $json.texto }}',
    additionalFields: { appendAttribution: false }
  },
  id: 'resp', name: 'Responder', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [1200, 300], credentials: CRED_TG
});

const connections = {
  'Telegram Trigger': { main: [[{ node: 'Cargar inventario', type: 'main', index: 0 }]] },
  'Cargar inventario': { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Agente Inventario', type: 'main', index: 0 }]] },
  'OpenRouter Chat Model': { ai_languageModel: [[{ node: 'Agente Inventario', type: 'ai_languageModel', index: 0 }]] },
  'Memoria (chat)': { ai_memory: [[{ node: 'Agente Inventario', type: 'ai_memory', index: 0 }]] },
  'Agente Inventario': { main: [[{ node: 'Parsear accion', type: 'main', index: 0 }]] },
  'Parsear accion': { main: [[{ node: 'Switch', type: 'main', index: 0 }]] },
  'Switch': {
    main: [
      [{ node: 'PUT stock', type: 'main', index: 0 }],
      [{ node: 'PATCH publicar', type: 'main', index: 0 }],
      [{ node: 'PATCH despublicar', type: 'main', index: 0 }],
      [{ node: 'PUT editar', type: 'main', index: 0 }],
      [{ node: 'POST crear', type: 'main', index: 0 }],
      [{ node: 'Armar respuesta', type: 'main', index: 0 }]
    ]
  },
  'PUT stock': { main: [[{ node: 'Armar respuesta', type: 'main', index: 0 }]] },
  'PATCH publicar': { main: [[{ node: 'Armar respuesta', type: 'main', index: 0 }]] },
  'PATCH despublicar': { main: [[{ node: 'Armar respuesta', type: 'main', index: 0 }]] },
  'PUT editar': { main: [[{ node: 'Armar respuesta', type: 'main', index: 0 }]] },
  'POST crear': { main: [[{ node: 'Armar respuesta', type: 'main', index: 0 }]] },
  'Armar respuesta': { main: [[{ node: 'Responder', type: 'main', index: 0 }]] }
};

function post(path, body) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const r = https.request({
      hostname: 'n8n.seiva.com.py', path, method: 'POST',
      headers: { 'X-N8N-API-KEY': K, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => res({ status: resp.statusCode, body: d })); });
    r.on('error', rej);
    r.write(data); r.end();
  });
}

(async () => {
  const r = await post('/api/v1/workflows', {
    name: 'Seiva - Agente Inventario v2 (sin tools)',
    nodes, connections,
    settings: { executionOrder: 'v1' }
  });
  console.log('CREATE HTTP', r.status);
  const j = JSON.parse(r.body);
  console.log('id:', j.id, '| name:', j.name);
  fs.writeFileSync('v2_id.txt', j.id);
})();
