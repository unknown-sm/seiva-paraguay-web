// Diagnóstico: ¿por qué falla el scrape de magazineluiza.com.br?
const u = process.argv[2] || 'https://www.magazineluiza.com.br/mag10-complex-500mg-120-capsulas-uniervas-premium-sem-sabor-uni-ervas/p/fc1376g109/sa/samg/';
(async () => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(u, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const html = await r.text();
    console.log('HTTP', r.status, '| len', html.length, '| final url:', r.url);
    const og = html.match(/property=["']og:title["'] content=["']([^"']+)/i);
    console.log('OG:TITLE =>', og ? og[1].slice(0, 160) : '(no)');
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    console.log('H1 =>', h1 ? h1[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : '(no)');
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    console.log('TITLE =>', title ? title[1].trim().slice(0, 160) : '(no)');
    console.log('JSON-LD =>', /application\/ld\+json/i.test(html) ? 'SI presente' : 'no');
    console.log('BLOCK =>', /captcha|just a moment|attention required|acesso negado|akamai|cloudflare|403 forbidden/i.test(html) ? 'SI (parece bloqueo)' : 'no');
  } catch (e) {
    console.log('ERROR:', e.name, '-', e.message);
  }
  clearTimeout(t);
})();
