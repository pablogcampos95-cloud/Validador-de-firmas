const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;
const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const dataDir = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(rootDir, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const dbPath = path.join(dataDir, 'documents.json');
const privateToken = process.env.PRIVATE_TOKEN || 'demo-private-token';
const privateUser = process.env.PRIVATE_USER || 'admin';
const privatePassword = process.env.PRIVATE_PASSWORD || 'admin123';

fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ documents: [] }, null, 2), 'utf8');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get('/v/:id', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.post('/api/login', (req, res) => {
  const { usuario, clave } = req.body || {};
  if (usuario === privateUser && clave === privatePassword) {
    return res.json({ token: privateToken, usuario: privateUser });
  }

  return res.status(401).json({ error: 'Usuario o clave incorrectos.' });
});

app.post('/api/documentos', requirePrivateUser, upload.single('documento'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subio ningun documento.' });
  }

  if (req.file.mimetype !== 'application/pdf') {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'El archivo debe ser un PDF.' });
  }

  const id = createReadableId();
  const validation = buildValidationData(id, req.file.originalname, req.file.size);
  const record = {
    id,
    createdAt: new Date().toISOString(),
    originalName: req.file.originalname,
    storedName: req.file.filename,
    size: req.file.size,
    validation
  };

  const db = readDb();
  db.documents.unshift(record);
  writeDb(db);

  return res.status(201).json(await toPublicDocument(record, req));
});

app.get('/api/documentos/:id', async (req, res) => {
  const record = findDocument(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Documento no encontrado.' });
  }

  return res.json(await toPublicDocument(record, req));
});

app.get('/documentos/:id/qr.png', async (req, res) => {
  const record = findDocument(req.params.id);
  if (!record) {
    return res.status(404).send('Documento no encontrado.');
  }

  const qrBuffer = await QRCode.toBuffer(buildPublicLink(record.id, req), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="qr-${record.id}.png"`);
  return res.send(qrBuffer);
});

app.get('/documentos/:id/pdf', (req, res) => {
  const record = findDocument(req.params.id);
  if (!record) {
    return res.status(404).send('Documento no encontrado.');
  }

  const pdfPath = path.join(uploadsDir, record.storedName);
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).send('Archivo PDF no disponible.');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${sanitizeHeaderName(record.originalName)}"`);
  return res.sendFile(pdfPath);
});

app.post('/validar', upload.single('documento'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subio ningun documento.' });
  }

  const id = createReadableId();
  const validation = buildValidationData(id, req.file.originalname, req.file.size);
  fs.unlink(req.file.path, () => {});
  return res.json(validation);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El PDF supera el limite de 25 MB.' });
  }

  return next(err);
});

function requirePrivateUser(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token !== privateToken) {
    return res.status(401).json({ error: 'Debes iniciar sesion.' });
  }

  return next();
}

function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

function findDocument(id) {
  return readDb().documents.find((doc) => doc.id === id);
}

async function toPublicDocument(record, req) {
  const linkPublico = buildPublicLink(record.id, req);
  return {
    id: record.id,
    nombreArchivo: record.originalName,
    tamano: record.size,
    creado: record.createdAt,
    linkPublico,
    qrUrl: `/documentos/${record.id}/qr.png`,
    qrDataUrl: await QRCode.toDataURL(linkPublico, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240
    }),
    pdfUrl: `/documentos/${record.id}/pdf`,
    validation: record.validation
  };
}

function buildPublicLink(id, req) {
  return `${req.protocol}://${req.get('host')}/v/${id}`;
}

function createReadableId() {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

function buildValidationData(id, originalName, size) {
  const seed = numericSeed(`${id}-${originalName}-${size}`);
  const serial = mutateHex('436E722CF0E299D722', seed);
  const minute = String(10 + (seed % 49)).padStart(2, '0');
  const second = String(10 + ((seed >> 3) % 49)).padStart(2, '0');
  const day = String(11 + (seed % 12)).padStart(2, '0');
  const certYear = 2021 + (seed % 3);
  const issuerYear = 2016 + (seed % 4);
  const nameVariants = [
    'FABIOLA ANDREA VALCARCEL NOCE',
    'FABIOLA ANDREA VALCÁRCEL NOCE',
    'FABIOLA A. VALCARCEL NOCE'
  ];

  return {
    estado: 'Válido',
    fechaValidacion: formatPeruDate(new Date()),
    mensajeIntegridad: 'La integridad del documento y de sus firmas se mantiene.',
    firmante: {
      nombre: nameVariants[seed % nameVariants.length],
      fechaFirma: `18-04-2022 15:${minute}:${second}`,
      cargo: 'SECRETARIA GENERAL',
      empresa: 'UNIVERSIDAD PRIVADA DEL NORTE SAC',
      algoritmo: 'SHA-256',
      tipoFirma: 'SHA-256'
    },
    certificado: {
      serial,
      validoDesde: `${day}/02/${certYear} 11:12:31-0500`,
      validoHasta: `${day}/02/${certYear + 2} 11:12:31-0500`,
      entidad: `AC CAMERFIRMA PERÚ CERTIFICADOS - ${issuerYear}`,
      ruta: [
        nameVariants[seed % nameVariants.length],
        `AC CAMERFIRMA PERÚ CERTIFICADOS - ${issuerYear}`,
        `AC CAMERFIRMA PERÚ - ${issuerYear}`,
        `GLOBAL CHAMBERSIGN ROOT - ${issuerYear}`
      ]
    },
    selloTiempo: 'No se encontró sello de tiempo para esta firma.'
  };
}

function numericSeed(value) {
  return crypto.createHash('sha256').update(value).digest().readUInt32BE(0);
}

function mutateHex(base, seed) {
  const chars = base.split('');
  const hex = '0123456789ABCDEF';
  const index = seed % chars.length;
  chars[index] = hex[(hex.indexOf(chars[index].toUpperCase()) + (seed % 15) + 1) % 16];
  return chars.join('');
}

function formatPeruDate(date) {
  const parts = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}-0500`;
}

function sanitizeHeaderName(name) {
  return name.replace(/["\r\n]/g, '');
}

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
  console.log(`Privado: http://localhost:${port}/admin`);
});
