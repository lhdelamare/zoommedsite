import { Router, Request, Response } from 'express';
import { AsaasService } from '../services/asaas.js';

const router = Router();

// 1. Process PIX Transparent Checkout
router.post('/pix', async (req: Request, res: Response) => {
  try {
    const { customer, planName, value, description } = req.body;

    if (!customer || !customer.name || !customer.cpfCnpj || !customer.email || !customer.birthDate) {
      return res.status(400).json({ error: 'Dados do cliente incompletos (Nome, CPF/CNPJ, E-mail e Data de Nascimento são obrigatórios).' });
    }

    if (!value || value <= 0) {
      return res.status(400).json({ error: 'Valor da cobrança inválido.' });
    }

    const pixData = await AsaasService.createPixCharge({
      customer,
      planName: planName || 'Plano Zoommed',
      value: Number(value),
      description,
    });

    return res.json({ success: true, data: pixData });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Erro ao gerar PIX' });
  }
});

// 2. Process Credit Card Transparent Checkout
router.post('/creditcard', async (req: Request, res: Response) => {
  try {
    const { customer, planName, value, creditCard, creditCardHolderInfo, description } = req.body;

    if (!customer || !customer.name || !customer.cpfCnpj || !customer.email || !customer.birthDate) {
      return res.status(400).json({ error: 'Dados do cliente incompletos (Data de nascimento obrigatória).' });
    }

    if (!creditCard || !creditCard.number || !creditCard.expiryMonth || !creditCard.expiryYear || !creditCard.ccv) {
      return res.status(400).json({ error: 'Dados do cartão de crédito incompletos.' });
    }

    const cardData = await AsaasService.createCreditCardCharge({
      customer,
      planName: planName || 'Plano Zoommed',
      value: Number(value),
      creditCard,
      creditCardHolderInfo: creditCardHolderInfo || {
        name: creditCard.holderName,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        postalCode: customer.postalCode || '00000000',
        addressNumber: customer.addressNumber || 'S/N',
        phone: customer.mobilePhone || customer.phone || '11999999999',
      },
      description,
    });

    return res.json({ success: true, data: cardData });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Erro ao processar cartão de crédito' });
  }
});

// 3. Process Boleto Transparent Checkout
router.post('/boleto', async (req: Request, res: Response) => {
  try {
    const { customer, planName, value, description } = req.body;

    if (!customer || !customer.name || !customer.cpfCnpj || !customer.email) {
      return res.status(400).json({ error: 'Dados do cliente incompletos.' });
    }

    const boletoData = await AsaasService.createBoletoCharge({
      customer,
      planName: planName || 'Plano Zoommed',
      value: Number(value),
      description,
    });

    return res.json({ success: true, data: boletoData });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Erro ao gerar boleto' });
  }
});

// 4. Payment Status Check
router.get('/status/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const statusData = await AsaasService.getPaymentStatus(paymentId);
    return res.json({ success: true, data: statusData });
  } catch (error: any) {
    return res.status(404).json({ success: false, error: error.message });
  }
});

// 5. Asaas Webhook Listener
router.post('/webhooks/asaas', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('Recebido Webhook do Asaas:', event.event, event.payment?.id);
    // Handle payment events: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, etc.
    return res.status(200).json({ received: true });
  } catch (error: any) {
    return res.status(500).send();
  }
});

export default router;
