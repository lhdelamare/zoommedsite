import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import checkoutRouter from './routes/checkout.js';
import productsRouter from './routes/products.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/checkout', checkoutRouter);
app.use('/api/products', productsRouter);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Resolve frontend production build path with fallbacks
let distPath = path.join(__dirname, '../../dist');
if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  distPath = path.join(__dirname, '../dist');
}
if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  distPath = path.join(process.cwd(), 'dist');
}

console.log(`📁 Serving static dist files from: ${distPath}`);

app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Index HTML not found');
});

app.listen(PORT, () => {
  console.log(`🚀 Zoommed Server rodando na porta ${PORT}`);
  console.log(`👉 Environment Asaas API: ${process.env.ASAAS_API_URL || 'https://api.asaas.com/v3'}`);
});
