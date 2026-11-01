// Crea la cuenta de administrador (o le cambia la contraseña si ya existe).
//   npm run crear-admin
// Sin preguntas (por ejemplo en el servidor):
//   ADMIN_USERNAME=carlitos ADMIN_PASSWORD='...' npm run crear-admin
import readline from 'node:readline';
import { config } from '../src/config.js';
import { createStore, openDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '');
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    })
  );
}

const username = process.env.ADMIN_USERNAME || (await ask('Usuario: '));
const password = process.env.ADMIN_PASSWORD || (await ask('Contraseña (mínimo 10 caracteres): ', { hidden: true }));

if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
  console.error('El usuario tiene que tener entre 3 y 40 letras, números, punto, guion o guion bajo.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('La contraseña tiene que tener al menos 10 caracteres.');
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD && (await ask('Repetí la contraseña: ', { hidden: true })) !== password) {
  console.error('Las contraseñas no coinciden.');
  process.exit(1);
}

const store = createStore(openDb(config.dataDir));
const existed = Boolean(store.findAdmin(username));
store.upsertAdmin(username, hashPassword(password));
console.log(existed ? `Listo, se cambió la contraseña de "${username}".` : `Listo, se creó la cuenta "${username}". Entrá en /admin`);
