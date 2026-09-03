const {DatabaseSync} = require('node:sqlite');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');

const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

// 1. Ver usuarios admin
console.log('=== usuarios activos ===');
try {
  const us = db.prepare("SELECT id, username, activo FROM usuarios").all();
  console.log(JSON.stringify(us));
} catch(e) { console.log('no tabla usuarios:', e.message); }

// 2. Leer JWT_SECRET igual que el server
const SECRET_FILE = '/app/data/.jwt_secret';
let secret;
if (fs.existsSync(SECRET_FILE)) {
  secret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  console.log('JWT_SECRET del archivo:', secret.substring(0,20) + '...');
} else {
  console.log('NO existe .jwt_secret');
}

// 3. Test firmar + verificar
if (secret) {
  const tok = jwt.sign({role:'admin'}, secret, {expiresIn:'24h'});
  try {
    const dec = jwt.verify(tok, secret);
    console.log('VERIFY OK -> token valido con secreto del archivo');
  } catch(e) {
    console.log('VERIFY FALLO:', e.message);
  }
}

// 4. ADMIN_PASSWORD / ADMIN_HASH en env
console.log('=== env ===');
console.log('ADMIN_PASSWORD set:', !!process.env.ADMIN_PASSWORD);
console.log('ADMIN_HASH set:', !!process.env.ADMIN_HASH);

db.close();
