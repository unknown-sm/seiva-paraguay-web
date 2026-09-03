const crypto = require('crypto');

// Secreto local (copiado de seiva-static/backend/data/.jwt_secret)
const LOCAL_SECRET = 'sva-jwt-fabd6992f06f5b7ed746de107166761e2594cd2d8573fa51';
// Token viejo hardcodeado en el workflow n8n
const STALE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJpZCI6MSwiaWF0IjoxNzg3NjE5ODk5LCJleHAiOjIxMDI5Nzk4OTl9.EOwKkZgszm1F8x5Z3bV9fKyiNQLe6NVTyX1e9ck1l4s';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function sign(secret, payload) {
  const h = { alg: 'HS256', typ: 'JWT' };
  const head = b64url(h);
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(head + '.' + body).digest('base64url');
  return head + '.' + body + '.' + sig;
}

// Token fresco firmado con el secreto local (role admin, exp lejano)
const now = Math.floor(Date.now() / 1000);
const fresh = sign(LOCAL_SECRET, { role: 'admin', id: 1, iat: now, exp: now + 60 * 60 * 24 * 365 });

async function test(label, token) {
  try {
    const res = await fetch('https://seiva.com.py/api/productos/all', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    let body = '';
    try { body = (await res.text()).slice(0, 200); } catch (e) {}
    console.log(label.padEnd(22), '-> HTTP', res.status, '|', body.replace(/\s+/g, ' '));
  } catch (e) {
    console.log(label.padEnd(22), '-> ERROR', e.message);
  }
}

(async () => {
  console.log('--- TEST ACCESO PRODUCCION ---');
  await test('ping (sin auth)', null);
  await test('stale (viejo)', STALE);
  await test('fresh (secreto local)', fresh);
  console.log('\nfresh token:', fresh);
})();
