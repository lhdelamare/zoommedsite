import { Router, Request, Response } from 'express';
import { DatabaseService } from '../db/supabase.js';

const router = Router();

// GET /api/products - Get full product and plan catalog from Supabase
router.get('/', async (req: Request, res: Response) => {
  try {
    const products = await DatabaseService.getProductsCatalog();
    return res.json({ success: true, data: products });
  } catch (error: any) {
    console.error('Error fetching products endpoint:', error);
    return res.status(500).json({ success: false, error: 'Falha ao buscar catálogo de produtos.' });
  }
});

export default router;
