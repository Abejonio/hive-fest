// server.js — Backend seguro con Argon2id y registro único por IP

// 1) Importa librerías del sistema y de terceros
const express = require("express");               // Framework HTTP minimalista
const cors = require("cors");                     // Control de CORS (orígenes permitidos)
const fs = require("fs");                         // Lectura/escritura de archivos
const path = require("path");                     // Utilidades de rutas
const helmet = require("helmet");                 // Cabeceras de seguridad
const rateLimit = require("express-rate-limit");  // Limitador de peticiones por IP
const argon2 = require("argon2");                 // Hashing seguro (Argon2id)
const { nanoid } = require("nanoid");             // IDs únicos cortos
const { z } = require("zod");                     // Validación de datos
require("dotenv").config();                       // Carga variables de entorno desde .env

// 2) Crea la app Express
const app = express();                            // Instancia del servidor Express

// 3) Seguridad base con Helmet
app.use(helmet({                                  // Activa cabeceras de seguridad
  contentSecurityPolicy: false,                   // Desactiva CSP estricta si usas inline scripts
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permite cargar recursos estáticos
}));
app.disable("x-powered-by");                      // Oculta cabecera X-Powered-By

// 4) Parser de JSON con límite
app.use(express.json({ limit: "32kb" }));         // Limita payloads para evitar abusos

// 5) CORS (ajusta el origen permitido si sirves desde otro host/puerto)
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://0.0.0.0:3000";
app.use(cors({ origin: CORS_ORIGIN }));           // Habilita CORS para el front

const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

// --- Sesiones con cookies seguras ---
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: __dirname }), // fichero donde se guardan
  secret: process.env.SESSION_SECRET || "cambia_esto_por_una_cadena_larga", // secreto para firmar cookies
  resave: false,                   // no guarda la sesión si no hay cambios
  saveUninitialized: false,        // no guarda sesiones vacías
  cookie: {
    httpOnly: true,                // inaccesible desde JS → evita XSS
    sameSite: "strict",            // la cookie solo viaja en tu sitio
    secure: process.env.NODE_ENV === "production",                 // ⚠️ pon true si usas HTTPS
    maxAge: 1000 * 60 * 60 * 3     // 2h de sesión
  }
}));

// 6) Rate limit global para rutas /api (antispam/antibruteforce por IP)
app.use("/api/", rateLimit({
  windowMs: 1000,                       // Ventana de 10 minutos
  max: 30,
  standardHeaders: true,                          // Devuelve info en cabeceras estándar
  legacyHeaders: false,                           // No usar cabeceras obsoletas
}));

// 7) Sirve estáticos y define páginas básicas
app.use(express.static(path.join(__dirname, "./public")));        // Carpeta /public
app.get("/login", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/stats"); // ya logueado → stats
  }
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/signup", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/stats"); // ya logueado → stats
  }
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});
app.get("/stats", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // no logueado → login
  }
  res.sendFile(path.join(__dirname, "public", "stats.html"));
});
app.get("/leaderboard", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // no logueado → login
  }
  res.sendFile(path.join(__dirname, "public", "leaderboard.html"));
});
app.get("/market", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // no logueado → login
  }
  res.sendFile(path.join(__dirname, "public", "market.html"));
});
app.get("/questions", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // no logueado → login
  }
  res.sendFile(path.join(__dirname, "public", "questions.html"));
});
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "start.html")));        // raíz

// 8) Rutas de ficheros de “base de datos” en disco
const USERS_PATH = path.join(__dirname, "users.json");  // Perfiles del juego (público)
const AUTH_PATH  = path.join(__dirname, "auth.json");   // Datos sensibles (hashes/IPs)
const WHITELIST_PATH = path.join(__dirname, "ip_whitelist.json");
const COLLECTIONS_PATH = path.join(__dirname, "collections.json");

function readWhitelist() {
  return JSON.parse(fs.readFileSync(WHITELIST_PATH, "utf-8"));
}

// 9) Asegura que los ficheros existen y tienen estructura inicial
function ensureFile(file, initObj) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initObj, null, 2)); // Crea si falta
}
ensureFile(USERS_PATH, { users: {} });            // users.json: { users: {} }
ensureFile(AUTH_PATH,  { auth:  {} });            // auth.json:  { auth:  {} }
ensureFile(COLLECTIONS_PATH, { collections: {} });

// 10) Databases Functions
// Stats+Questions Databases
function readUsersDB() {
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
}
function writeUsersDB(db) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(db, null, 2));
}

// Users/Passwords Databases
function readAuthDB() {
  return JSON.parse(fs.readFileSync(AUTH_PATH, "utf-8"));
}
function writeAuthDB(db) {
  fs.writeFileSync(AUTH_PATH, JSON.stringify(db, null, 2));
}

// Collections Databases
function readCollectionsDB() {
  return JSON.parse(fs.readFileSync(COLLECTIONS_PATH, "utf-8"));
}
function writeCollectionsDB(db) {
  fs.writeFileSync(COLLECTIONS_PATH, JSON.stringify(db, null, 2));
}

// 11) Esquemas de validación (Zod) con tus reglas
const usernameSchema = z.string()                 // Usuario de 2–20
  .min(2).max(20)
  .regex(/^[a-zA-Z]+$/);                  // Permite letras, dígitos, ., _, -, espacio
const passwordSchema = z.string()                 // Contraseña de 3–28
  .min(3).max(28);

const signupSchema = z.object({                   // Cuerpo esperado en /api/signup
  username: usernameSchema,
  password: passwordSchema,
});
const loginSchema = z.object({                    // Cuerpo esperado en /api/login
  username: usernameSchema,
  password: z.string().min(1),
});

// 12) Parámetros de Argon2id (balance rendimiento/seguridad)
const argonOptions = {
  type: argon2.argon2id,                          // Variante Argon2id (recomendada)
  timeCost: 3,                                    // Iteraciones
  memoryCost: 2 ** 16,                            // 64 MB
  parallelism: 1,                                 // Paralelismo
};

// 13) Utilidades varias
const PEPPER = process.env.PEPPER || "";          // Secreto del servidor para añadir a la contraseña
const nowISO = () => new Date().toISOString();    // Timestamp ISO (legible/ordenable)
const toLower = (s) => s.trim().toLowerCase();    // Normaliza a minúsculas sin espacios
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); // Retardo asíncrono

// --- Tiempo en Europa/Madrid y reseteo diario ---
const MADRID_TZ = "Europe/Madrid";

// Devuelve un objeto con las partes de fecha/hora en Madrid para un Date dado
function madridParts(date = new Date()) {
  const partsArr = new Intl.DateTimeFormat("en-US", {
    timeZone: MADRID_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const parts = {};
  for (const p of partsArr) parts[p.type] = p.value;
  return parts; // {year, month, day, hour, minute, second}
}

// Devuelve 'YYYY-MM-DD' de hoy en Madrid
function madridDateString(date = new Date()) {
  const p = madridParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

// --- Migración ligera: añade todayHoney/lastDailyReset si faltan y normaliza día actual ---
(() => {
  const usersDB = readUsersDB();
  const today = madridDateString();
  let touched = false;
  for (const user of Object.values(usersDB.users || {})) {
    if (!user) continue;
    let changed = false;
    if (typeof user.todayHoney !== "number") { user.todayHoney = 0; changed = true; }
    if (typeof user.lastDailyReset !== "string") { user.lastDailyReset = today; changed = true; }
    // Si el fichero quedó de ayer y el server arranca hoy → reset
    if (user.lastDailyReset !== today) { user.todayHoney = 0; user.lastDailyReset = today; changed = true; }
    touched = touched || changed;
  }
  if (touched) writeUsersDB(usersDB);
})();

// Obtiene el offset (ms) de la zona horaria para una fecha concreta (técnica sin libs)
function timeZoneOffsetMs(timeZone, date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUTC - date.getTime(); // positivo si TZ está por delante de UTC
}

// Devuelve el timestamp UTC (ms) de la medianoche siguiente en Madrid
function nextMadridMidnightUTCms(now = new Date()) {
  // 1) Fecha actual en Madrid
  const p = madridParts(now);
  const year = +p.year, month = +p.month, day = +p.day;

  // 2) "Medianoche de mañana" en la pared de Madrid (00:00)
  const guessUTC = Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0);

  // 3) Corrige por offset de Madrid en esa fecha/instante (maneja cambios de DST)
  const offsetAtTarget = timeZoneOffsetMs(MADRID_TZ, new Date(guessUTC));
  const targetUTC = guessUTC - offsetAtTarget;
  return targetUTC;
}

// Asegura que un usuario tiene los campos diarios y aplica reset si cambió el día (Madrid)
function ensureDailyFieldsAndResetIfNeeded(user) {
  if (typeof user.todayHoney !== "number") user.todayHoney = 0;
  const today = madridDateString();
  if (typeof user.lastDailyReset !== "string") {
    user.lastDailyReset = today;
  } else if (user.lastDailyReset !== today) {
    user.todayHoney = 0;
    user.lastDailyReset = today;
  }
}

// Resetea todayHoney a 0 de TODOS los usuarios y fija lastDailyReset = hoy (Madrid)
function resetAllDailyHoney() {
  const db = readUsersDB();
  const today = madridDateString();
  for (const user of Object.values(db.users || {})) {
    if (!user) continue;
    user.todayHoney = 0;
    user.lastDailyReset = today;
  }
  writeUsersDB(db);
  console.log(`[daily-reset] Reiniciadas todayHoney de todos a 0 (${today} ${MADRID_TZ}).`);
}

// Programa el reseteo de forma perpetua, respetando cambios de horario de verano/invierno
function scheduleDailyReset() {
  const now = Date.now();
  const nextMidnightUTC = nextMadridMidnightUTCms(new Date(now));
  const delay = Math.max(0, nextMidnightUTC - now);
  setTimeout(() => {
    // Ejecuta el reseteo
    resetAllDailyHoney();
    // Recalcula la siguiente medianoche y vuelve a programar
    scheduleDailyReset();
  }, delay);
}


// 14) Obtiene la IP real del cliente (respeta proxies tipo Nginx)
function getClientIP(req) {
  const xf = req.headers["x-forwarded-for"];      // Cabecera que lista IPs del cliente y proxies
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0].trim();               // Toma la primera IP (cliente original)
  }
  return req.socket.remoteAddress || "unknown";   // Fallback: IP de la conexión
}

// 15) Búsqueda por usernameLower en auth.json
function findAuthByUsernameLower(authDB, unameLower) {
  for (const [userId, record] of Object.entries(authDB.auth || {})) {
    if (record.usernameLower === unameLower) {    // Coincide en minúsculas
      return { userId, authRecord: record };      // Devuelve id y registro
    }
  }
  return null;                                    // No encontrado
}

// 16) Genera un ID único que no exista en users.json
function generateUniqueId(usersDB) {
  const ids = Object.keys(usersDB.users).map(Number);

  // Si no existen usuarios todavía → ID inicial
  if (ids.length === 0) {
    return "1"; // o el número inicial que quieras
  }

  const lastId = Math.max(...ids);

  // Número de dígitos del último ID
  const length = String(lastId).length;

  // Incremento máximo = (length * 5) ^ 1.25
  const maxIncrement = Math.round(Math.pow(length * 5, 1.25));

  // Incremento aleatorio entre 1 y maxIncrement
  const increment = Math.floor(Math.random() * maxIncrement) + 1;

  const newId = lastId + increment;

  return String(newId);
}

// 17) Anti-bruteforce con retardo progresivo por IP (NO bloquea cuentas)
const failMap = new Map();                        // Mapa IP -> { count, last }
const FAIL_WINDOW_MS = 10 * 60 * 1000;            // Ventana de 10 min para acumular fallos
const MAX_DELAY_MS   = 2000;                      // Máximo retardo: 2 segundos
const STEP_MS        = 200;                       // Incremento por fallo: 200 ms

// 18) Pre-calcula un hash dummy para “igualar tiempos” si el usuario no existe
let DUMMY_HASH;                                    // Hash simulado para camino falso
(async () => {
  DUMMY_HASH = await argon2.hash("x" + PEPPER, argonOptions); // Hash de una constante
})();                                              // IIFE asíncrona al arrancar

// 19) ENDPOINT: Registro (signup) con una cuenta por IP
app.post("/api/signup", async (req, res) => {      // Define POST /api/signup
  try {
    const parsed = signupSchema.safeParse(req.body); // Valida body
    if (!parsed.success) {                           // Si no cumple
      return res.status(400).json({ ok: false, message: "Neither symbols and spaces are permitted (except _ and -)" }); // Respuesta neutra
    }
    const { username, password } = parsed.data;      // Extrae datos validados
    const unameLower = toLower(username);            // Normaliza usuario
    const clientIP = getClientIP(req);               // IP del cliente

    const usersDB = readUsersDB();                   // Lee users.json
    const authDB  = readAuthDB();                    // Lee auth.json

    // Regla: sólo 1 cuenta por IP (bloquea la 2ª y siguientes)
    const whitelist = readWhitelist();
    if (!whitelist.multiAllowed.includes(clientIP)) {
        for (const rec of Object.values(authDB.auth || {})) {
            if (rec.registrationIP === clientIP) {
                return res.status(409).json({ ok: false, message: "You already have an account" });
            }
        }
    }


    // Unicidad por nombre (case-insensitive)
    if (findAuthByUsernameLower(authDB, unameLower)) {        // Si ya existe el username (en minúsculas)
      return res.status(409).json({ ok: false, message: "This username already exists" }); // Respuesta neutra
    }

    // Hashea la contraseña + pepper con Argon2id
    const passwordHash = await argon2.hash(password + PEPPER, argonOptions); // Hash seguro

    // Crea un nuevo ID único y guarda en users.json con tu estructura
    let n1, n2, typeN, type;
    typeN = Math.floor(Math.random() * 4);
    if (typeN == 0) {
      type = "sum"
      n1 = Math.floor(Math.random() * 100) + 1;
      n2 = Math.floor(Math.random() * 100) + 1;

    } else if (typeN == 1) {
      type = "subtraction"
      n1 = Math.floor(Math.random() * 100) + 1;
      n2 = Math.floor(Math.random() * 100) + 1;
      if (n1 < n2) {
        let a = n2
        n2 = n1
        n1 = n2
      }

    } else if (typeN == 2) {
      type = "multiplication"
      n1 = Math.floor(Math.random() * 11) + 1;
      n2 = Math.floor(Math.random() * 11) + 1;

    } else {
      type = "division"
      n2 = Math.floor(Math.random() * 11) + 1;
      n1 = (Math.floor(Math.random() * 11) + 1) * n2;

    }

    const userId = generateUniqueId(usersDB);       // Genera ID único
    usersDB.users[userId] = {                       // Estructura pedida
      username,                                     // Conserva el “case” original
      accountCreatedAt: nowISO(),                   // Timestamp ISO
      collection: {},                               // Colección vacía por defecto
      honey: 0,                                     // Honey inicial (ajusta si quieres)
      favCharacImage: "./assets/HiveFest.png",
      stats: {
        bigPrizes: 0,
        greatPrizes: 0,
        goodPrizes: 0,
        played: 0,
        totalHoney: 0
      },
      actualQuestion: {
        type,
        n1,
        n2
      }
    };
    writeUsersDB(usersDB);                          // Persistir users.json

    // Guarda datos sensibles en auth.json (separado del público)
    authDB.auth[userId] = {                         // Registro vinculado al mismo userId
      usernameLower: unameLower,                    // Para búsquedas sin distinción de may/min
      passwordHash,                                 // Hash Argon2id
      registrationIP: clientIP,                     // **IP usada para registrarse** (clave para tu regla)
      pwVersion: 1,                                 // Versión de parámetros de hash
      lastLogin: null,                              // Último login (se actualizará)
    };
    writeAuthDB(authDB);                            // Persistir auth.json

    return res.status(201).json({ ok: true });      // Éxito de alta
  } catch (err) {                                   // Manejo de errores
    console.error("signup error:", err);            // Log en servidor (sin datos sensibles)
    return res.status(500).json({ ok: false, message: "Server error." }); // Error genérico
  }
});

// 20) ENDPOINT: Login sin bloqueo por cuenta (retardo progresivo por IP)
app.post("/api/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: "Invalid credentials." });
    }
    const { username, password } = parsed.data;
    const unameLower = toLower(username);
    const clientIP = getClientIP(req);

    const usersDB = readUsersDB();
    const authDB  = readAuthDB();

    // busca usuario
    let userId = null, authRecord = null;
    for (const [uid, rec] of Object.entries(authDB.auth || {})) {
      if (rec.usernameLower === unameLower) { userId = uid; authRecord = rec; break; }
    }

    // verifica credenciales
    const ok = authRecord
      ? await argon2.verify(authRecord.passwordHash, password + PEPPER, argonOptions)
      : await argon2.verify(DUMMY_HASH, "x" + PEPPER, argonOptions);

    if (!authRecord || !ok) {
      return res.status(401).json({ ok: false, message: "Invalid credentials." });
    }

    // 🔹 1) Si ya tenía sesión en otro sitio → destruirla
    const whitelist = readWhitelist();
        if (!whitelist.multiAllowed.includes(clientIP) && authRecord.sessionId) {
            const store = req.sessionStore;
            store.destroy(authRecord.sessionId, (err) => {
                if (err) console.error("Error destroying old session:", err);
            }
        );
    }

    // 🔹 2) Actualizar sesión actual con el nuevo usuario
    req.session.userId = userId;
    req.session.username = usersDB.users[userId].username;

    // 🔹 3) Guardar el nuevo sessionID en auth.json
    authRecord.lastLogin = nowISO();
    authRecord.sessionId = req.sessionID;
    writeAuthDB(authDB);

    return res.json({ ok: true, profile: usersDB.users[userId] });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ ok: false, message: "Server error." });
  }
});


app.get("/api/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, message: "Not logged in" });
  }
  const usersDB = readUsersDB();
  return res.json({ ok: true, userId: req.session.userId, profile: usersDB.users[req.session.userId] });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("logout error:", err);
      return res.status(500).json({ ok: false });
    }
    res.clearCookie("connect.sid"); // borra la cookie de sesión
    return res.json({ ok: true });
  });
});

// ➕ Añadir honey random al usuario logueado
app.post("/api/add-honey", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, message: "Not logged in" });
  }

  const usersDB = readUsersDB();
  const user = usersDB.users[req.session.userId];
  if (!user) {
    return res.status(404).json({ ok: false, message: "User not found" });
  }

  ensureDailyFieldsAndResetIfNeeded(user);

  let finalRandomHoney = 0;

  if (user.todayHoney == 0) {
    let randomWheel = Math.floor(Math.random() * 1000)
    if (randomWheel < 600) {
      finalRandomHoney = 25
    } else if (randomWheel < 800) {
      finalRandomHoney = 50
    } else if (randomWheel < 900) {
      finalRandomHoney = 100
    } else if (randomWheel < 950) {
      finalRandomHoney = 200
    } else if (randomWheel < 995) {
      finalRandomHoney = 500
    } else {
      finalRandomHoney = 1000
    }
  } else if (user.todayHoney < 501) {
    finalRandomHoney = Math.floor(Math.random() * 26) + 25
  } else if (user.todayHoney < 1001) {
    finalRandomHoney = Math.floor(Math.random() * 11) + 10
  } else if (user.todayHoney < 2001) {
    finalRandomHoney = Math.floor(Math.random() * 6) + 5
  } else if (user.todayHoney < 5001) {
    finalRandomHoney = Math.floor(Math.random() * 5) + 1
  } else if (user.todayHoney < 7501) {
    finalRandomHoney = Math.floor(Math.random() * 3)
  } else {
    finalRandomHoney = Math.floor(Math.random() * 2)
  }

  user.honey += finalRandomHoney;
  user.todayHoney += finalRandomHoney;
  user.stats.totalHoney += finalRandomHoney;

  writeUsersDB(usersDB);

  return res.json({
    ok: true,
    added: finalRandomHoney,        // lo que se añadió esta vez
    honey: user.honey,         // total acumulado
    todayHoney: user.todayHoney,
    totalHoney: user.stats.totalHoney
  });
});

// 🔄 Cambiar pregunta actual
app.post("/api/change-question", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, message: "Not logged in" });
  }

  const usersDB = readUsersDB();
  const user = usersDB.users[req.session.userId];
  if (!user) {
    return res.status(404).json({ ok: false, message: "User not found" });
  }

  // Genera nueva pregunta (misma lógica que en signup)
  let n1, n2, typeN, type;
  typeN = Math.floor(Math.random() * 4);
  if (typeN == 0) {
    type = "sum";
    n1 = Math.floor(Math.random() * 100) + 1;
    n2 = Math.floor(Math.random() * 100) + 1;
  } else if (typeN == 1) {
    type = "subtraction";
    n1 = Math.floor(Math.random() * 100) + 1;
    n2 = Math.floor(Math.random() * 100) + 1;
    if (n1 < n2) [n1, n2] = [n2, n1];
  } else if (typeN == 2) {
    type = "multiplication";
    n1 = Math.floor(Math.random() * 11) + 1;
    n2 = Math.floor(Math.random() * 11) + 1;
  } else {
    type = "division";
    n2 = Math.floor(Math.random() * 11) + 1;
    n1 = (Math.floor(Math.random() * 11) + 1) * n2;
  }

  user.actualQuestion = { type, n1, n2 };
  writeUsersDB(usersDB);

  return res.json({ ok: true, question: user.actualQuestion });
});

// === ENDPOINT: Leaderboard dinámico ===
app.get("/api/leaderboard", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, message: "Not logged in" });
  }

  const metricRaw = String(req.query.metric || "").toLowerCase();
  const ALLOWED = new Set(["honey", "totalhoney", "uniquehivees", "totalhivees"]);
  if (!ALLOWED.has(metricRaw)) {
    return res.status(400).json({ ok: false, message: "Unknown metric" });
  }

  const usersDB = readUsersDB();
  const items = [];

  const compute = (user) => {
    const coll = user.collection || {};
    if (metricRaw === "honey") return Number(user.honey || 0);
    if (metricRaw === "totalhoney") return Number(user.stats?.totalHoney || 0);
    if (metricRaw === "uniquehivees") {
      let uniq = 0;
      for (const k of Object.keys(coll)) {
        if (Number(coll[k] || 0) > 0) uniq++;
      }
      return uniq;
    }
    // totalhivees
    let sum = 0;
    for (const k of Object.keys(coll)) sum += Number(coll[k] || 0);
    return sum;
  };

  for (const user of Object.values(usersDB.users || {})) {
    if (!user) continue;
    items.push({
      username: user.username,
      avatar: user.favCharacImage || "./assets/HiveFest.png",
      value: compute(user),
    });
  }

  items.sort((a, b) => b.value - a.value);
  const top = items.slice(0, 10);

  return res.json({
    ok: true,
    metric: metricRaw,
    items: top,
  });
});

// 21) Catch-all: para rutas no API, redirige a la raíz (útil para SPA)
//    Evita interferir con /api/*
app.use((req, res, next) => {                       // Middleware final
  if (req.path.startsWith("/api/")) return next();  // No tocar peticiones API
  res.redirect("/");                                // Resto: ve a la home
});

// 22) Arranque del servidor
const PORT = process.env.PORT || 3000;              // Puerto desde .env o 3000
app.listen(PORT, "0.0.0.0", () => {                 // Escucha en todas las interfaces
  console.log(`Servidor en http://0.0.0.0:${PORT}`); // Log de arranque
});
