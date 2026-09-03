const {DatabaseSync} = require('node:sqlite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

// Generar password temporal aleatoria
const newPass = 'Seiva' + crypto.randomBytes(3).toString('hex').toUpperCase();
const hash = bcrypt.hashSync(newPass, 10);

const r = db.prepare("UPDATE usuarios SET password_hash = ?, activo = 1 WHERE username = 'admin'").run(hash);
console.log('Filas afectadas:', r.changes);
console.log('NUEVA PASSWORD TEMPORAL:', newPass);
console.log('Guardala, entra y cambiala despues.');

// Verificar que el hash matchea
const u = db.prepare("SELECT password_hash FROM usuarios WHERE username='admin'").get();
console.log('Verificacion bcrypt:', bcrypt.compareSync(newPass, u.password_hash));
db.close();
