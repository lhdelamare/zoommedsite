import { Router, Request, Response } from 'express';
import { AsaasService } from '../services/asaas.js';
import { DatabaseService } from '../db/supabase.js';

const router = Router();

// Helper to handle Supabase sync asynchronously without blocking user response if database has delay
async function syncPurchaseToSupabase({
  customerInput,
  asaasCustomerId,
  planName,
  value,
  paymentId,
  subscriptionId,
  billingType,
  status,
  dueDate,
  dependents = [],
}: {
  customerInput: any;
  asaasCustomerId: string;
  planName: string;
  value: number;
  paymentId: string;
  subscriptionId?: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  status: string;
  dueDate: string;
  dependents?: any[];
}) {
  try {
    const fullCustomerData = {
      ...customerInput,
      id: asaasCustomerId,
    };

    // 1. Sync Customer
    await DatabaseService.upsertCustomer(fullCustomerData);

    // 2. Sync Subscription & Payment
    await DatabaseService.saveSubscriptionAndPayment({
      paymentId,
      subscriptionId,
      customerId: asaasCustomerId,
      value,
      billingType,
      status,
      dueDate,
      planName,
      isSubscription: true,
    });

    // 3. Sync Beneficiaries (Holder + Dependents)
    await DatabaseService.saveBeneficiaries(fullCustomerData, dependents, 'S');
  } catch (err) {
    console.error('⚠️ Error in background Supabase sync:', err);
  }
}

// 1. Process PIX Transparent Checkout
router.post('/pix', async (req: Request, res: Response) => {
  try {
    const { customer, planName, value, description, dependents } = req.body;

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

    // Background sync with Supabase backoffice DB
    syncPurchaseToSupabase({
      customerInput: customer,
      asaasCustomerId: pixData.customerId,
      planName: planName || 'Plano Zoommed',
      value: Number(value),
      paymentId: pixData.paymentId,
      billingType: 'PIX',
      status: pixData.status || 'PENDING',
      dueDate: pixData.dueDate || new Date().toISOString().split('T')[0],
      dependents,
    });

    return res.json({ success: true, data: pixData });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Erro ao gerar PIX' });
  }
});

// 2. Process Credit Card Transparent Checkout
router.post('/creditcard', async (req: Request, res: Response) => {
  try {
    const { customer, planName, value, creditCard, creditCardHolderInfo, description, dependents } = req.body;

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

    // Background sync with Supabase backoffice DB
    syncPurchaseToSupabase({
      customerInput: customer,
      asaasCustomerId: cardData.customerId,
      planName: planName || 'Plano Zoommed',
      value: Number(value),
      paymentId: cardData.paymentId,
      billingType: 'CREDIT_CARD',
      status: cardData.status || 'CONFIRMED',
      dueDate: new Date().toISOString().split('T')[0],
      dependents,
    });

    return res.json({ success: true, data: cardData });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Erro ao processar cartão de crédito' });
  }
});

// 3. Process Boleto Transparent Checkout
router.post('/boleto', async (req: Request, res: Response) => {
  try {
    const { customer, planName, value, description, dependents } = req.body;

    if (!customer || !customer.name || !customer.cpfCnpj || !customer.email || !customer.birthDate) {
      return res.status(400).json({ error: 'Dados do cliente incompletos (Data de nascimento é obrigatória).' });
    }

    const boletoData = await AsaasService.createBoletoCharge({
      customer,
      planName: planName || 'Plano Zoommed',
      value: Number(value),
      description,
    });

    // Background sync with Supabase backoffice DB
    syncPurchaseToSupabase({
      customerInput: customer,
      asaasCustomerId: boletoData.customerId,
      planName: planName || 'Plano Zoommed',
      value: Number(value),
      paymentId: boletoData.paymentId,
      billingType: 'BOLETO',
      status: boletoData.status || 'PENDING',
      dueDate: boletoData.dueDate,
      dependents,
    });

    return res.json({ success: true, data: boletoData });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Erro ao gerar boleto' });
  }
});

// 4. Payment Status Check & Sync Update
router.get('/status/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const statusData = await AsaasService.getPaymentStatus(paymentId);

    // Update payment status in Supabase if status changed
    if (statusData.id && statusData.status) {
      DatabaseService.saveSubscriptionAndPayment({
        paymentId: statusData.id,
        customerId: statusData.customerId || '',
        value: statusData.value || 0,
        billingType: 'PIX',
        status: statusData.status,
        dueDate: statusData.dueDate || new Date().toISOString().split('T')[0],
        planName: 'Plano Zoommed',
      }).catch((e) => console.error('Error updating status in Supabase:', e));
    }

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

    if (event.payment) {
      const payment = event.payment;
      await DatabaseService.saveSubscriptionAndPayment({
        paymentId: payment.id,
        subscriptionId: payment.subscription,
        customerId: payment.customer,
        value: payment.value,
        netValue: payment.netValue,
        billingType: payment.billingType,
        status: payment.status,
        dueDate: payment.dueDate,
        description: payment.description,
        planName: payment.description || 'Plano Zoommed',
      });
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    return res.status(500).send();
  }
});

export default router;
