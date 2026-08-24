import axios from 'axios';

const getAsaasClient = () => {
  let apiKey = (process.env.ASAAS_API_KEY || '').trim();
  let baseURL = (process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3').trim();

  // If apiKey was truncated by shell expansion ($aact_hmlg stripped), restore $aact_hmlg prefix if key starts with _
  if (apiKey.startsWith('_') && !apiKey.startsWith('$aact_')) {
    apiKey = `$aact_hmlg${apiKey}`;
  }

  // Detect if key is a sandbox key
  const isSandboxKey = apiKey.includes('hmlg') || apiKey.startsWith('$aact_hmlg_');

  // Fallback to sandbox URL if using sandbox key with default prod url
  if (!baseURL || (isSandboxKey && (baseURL === 'https://api.asaas.com' || baseURL === 'https://api.asaas.com/v3'))) {
    baseURL = 'https://api-sandbox.asaas.com/v3';
  }

  // Ensure trailing slashes are removed and /v3 is appended
  baseURL = baseURL.replace(/\/+$/, '');
  if (!baseURL.endsWith('/v3')) {
    baseURL = `${baseURL}/v3`;
  }

  console.log(`🔌 Initializing Asaas Client (BaseURL: ${baseURL}, Key Prefix: ${apiKey.substring(0, 15)}...)`);

  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
  });
};

export interface CustomerInput {
  name: string;
  cpfCnpj: string;
  email: string;
  birthDate?: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
}

export interface PixCheckoutInput {
  customer: CustomerInput;
  planName: string;
  value: number;
  description?: string;
}

export interface CreditCardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone: string;
}

export interface CreditCardCheckoutInput {
  customer: CustomerInput;
  planName: string;
  value: number;
  creditCard: CreditCardInput;
  creditCardHolderInfo: CreditCardHolderInfo;
  description?: string;
}

export interface BoletoCheckoutInput {
  customer: CustomerInput;
  planName: string;
  value: number;
  description?: string;
}

export class AsaasService {
  /**
   * Find customer by CPF/CNPJ or create a new customer in Asaas
   */
  static async getOrCreateCustomer(input: CustomerInput): Promise<string> {
    const client = getAsaasClient();
    const cleanCpfCnpj = input.cpfCnpj.replace(/\D/g, '');

    try {
      // 1. Check if customer already exists
      console.log(`🔍 Searching customer in Asaas by CPF/CNPJ: ${cleanCpfCnpj}`);
      const searchRes = await client.get(`/customers?cpfCnpj=${cleanCpfCnpj}`);
      if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
        const existingId = searchRes.data.data[0].id;
        console.log(`✅ Customer found in Asaas: ${existingId}`);
        return existingId;
      }

      // 2. Create customer if not found
      console.log(`➕ Creating new customer in Asaas for: ${input.name} (${cleanCpfCnpj})`);
      const createRes = await client.post('/customers', {
        name: input.name,
        cpfCnpj: cleanCpfCnpj,
        email: input.email,
        phone: input.phone || input.mobilePhone,
        mobilePhone: input.mobilePhone || input.phone,
        postalCode: input.postalCode?.replace(/\D/g, ''),
        address: input.address,
        addressNumber: input.addressNumber,
        complement: input.complement,
        province: input.province,
      });

      console.log(`✅ Customer created successfully in Asaas: ${createRes.data.id}`);
      return createRes.data.id;
    } catch (error: any) {
      const errDetails = error?.response?.data || error.message;
      console.error('❌ Error in Asaas getOrCreateCustomer:', JSON.stringify(errDetails, null, 2));
      const firstErrorMsg = error?.response?.data?.errors?.[0]?.description;
      throw new Error(
        firstErrorMsg || `Falha ao cadastrar/localizar cliente no Asaas (${error.message}).`
      );
    }
  }

  /**
   * Create a PIX payment charge and retrieve QR Code + Copy & Paste payload
   */
  static async createPixCharge(input: PixCheckoutInput) {
    const client = getAsaasClient();
    const customerId = await this.getOrCreateCustomer(input.customer);

    try {
      const paymentRes = await client.post('/payments', {
        customer: customerId,
        billingType: 'PIX',
        value: input.value,
        dueDate: new Date().toISOString().split('T')[0],
        description: input.description || `Assinatura Zoommed - ${input.planName}`,
      });

      const paymentId = paymentRes.data.id;

      // Get PIX QR Code & CopyPaste payload
      const qrRes = await client.get(`/payments/${paymentId}/pixQrCode`);

      return {
        paymentId,
        customerId,
        value: paymentRes.data.value,
        status: paymentRes.data.status,
        dueDate: paymentRes.data.dueDate,
        encodedImage: qrRes.data.encodedImage, // Base64 QR Code image
        payload: qrRes.data.payload, // PIX copia e cola string
        expirationDate: qrRes.data.expirationDate,
      };
    } catch (error: any) {
      console.error('❌ Error in Asaas createPixCharge:', error?.response?.data || error.message);
      const firstErrorMsg = error?.response?.data?.errors?.[0]?.description;
      throw new Error(firstErrorMsg || 'Falha ao gerar cobrança PIX no Asaas.');
    }
  }

  /**
   * Create a Monthly Recurrent Subscription in Asaas (/subscriptions)
   */
  static async createSubscription(input: CreditCardCheckoutInput) {
    const client = getAsaasClient();
    const customerId = await this.getOrCreateCustomer(input.customer);

    try {
      const payload = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: input.value,
        nextDueDate: new Date().toISOString().split('T')[0],
        cycle: 'MONTHLY',
        description: input.description || `Assinatura Mensal Zoommed - ${input.planName}`,
        creditCard: input.creditCard,
        creditCardHolderInfo: input.creditCardHolderInfo,
      };

      console.log(`💳 Creating Monthly Subscription in Asaas for customer ${customerId}...`);
      const res = await client.post('/subscriptions', payload);

      return {
        subscriptionId: res.data.id,
        paymentId: res.data.id,
        customerId,
        value: res.data.value,
        status: res.data.status || 'ACTIVE',
        cycle: res.data.cycle || 'MONTHLY',
      };
    } catch (error: any) {
      console.error('❌ Error in Asaas createSubscription:', error?.response?.data || error.message);
      const firstErrorMsg = error?.response?.data?.errors?.[0]?.description;
      throw new Error(firstErrorMsg || 'Falha ao criar assinatura mensal no Asaas.');
    }
  }

  /**
   * Create a Credit Card single payment/charge
   */
  static async createCreditCardCharge(input: CreditCardCheckoutInput) {
    const client = getAsaasClient();
    const customerId = await this.getOrCreateCustomer(input.customer);

    try {
      const payload = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: input.value,
        dueDate: new Date().toISOString().split('T')[0],
        description: input.description || `Assinatura Zoommed - ${input.planName}`,
        creditCard: input.creditCard,
        creditCardHolderInfo: input.creditCardHolderInfo,
      };

      const res = await client.post('/payments', payload);

      return {
        paymentId: res.data.id,
        customerId,
        value: res.data.value,
        status: res.data.status,
        invoiceUrl: res.data.invoiceUrl,
      };
    } catch (error: any) {
      console.error('❌ Error in Asaas createCreditCardCharge:', error?.response?.data || error.message);
      const firstErrorMsg = error?.response?.data?.errors?.[0]?.description;
      throw new Error(firstErrorMsg || 'Falha ao processar pagamento com cartão no Asaas.');
    }
  }

  /**
   * Create a Boleto charge
   */
  static async createBoletoCharge(input: BoletoCheckoutInput) {
    const client = getAsaasClient();
    const customerId = await this.getOrCreateCustomer(input.customer);

    try {
      const res = await client.post('/payments', {
        customer: customerId,
        billingType: 'BOLETO',
        value: input.value,
        dueDate: new Date().toISOString().split('T')[0],
        description: input.description || `Assinatura Zoommed - ${input.planName}`,
      });

      const paymentId = res.data.id;
      const bankSlipRes = await client.get(`/payments/${paymentId}/identificationField`);

      return {
        paymentId,
        customerId,
        value: res.data.value,
        status: res.data.status,
        dueDate: res.data.dueDate || new Date().toISOString().split('T')[0],
        bankSlipUrl: res.data.bankSlipUrl,
        identificationField: bankSlipRes.data.identificationField, // Linha digitável do boleto
        invoiceUrl: res.data.invoiceUrl,
      };
    } catch (error: any) {
      console.error('❌ Error in Asaas createBoletoCharge:', error?.response?.data || error.message);
      const firstErrorMsg = error?.response?.data?.errors?.[0]?.description;
      throw new Error(firstErrorMsg || 'Falha ao gerar boleto no Asaas.');
    }
  }

  /**
   * Check status of a payment in Asaas
   */
  static async getPaymentStatus(paymentId: string) {
    const client = getAsaasClient();
    try {
      const res = await client.get(`/payments/${paymentId}`);
      return {
        id: res.data.id,
        customerId: res.data.customer,
        status: res.data.status, // PENDING, RECEIVED, CONFIRMED, OVERDUE, etc.
        value: res.data.value,
        dueDate: res.data.dueDate || new Date().toISOString().split('T')[0],
        confirmedDate: res.data.confirmedDate,
      };
    } catch (error: any) {
      console.error('❌ Error fetching payment status from Asaas:', error?.response?.data || error.message);
      throw new Error('Falha ao consultar status do pagamento.');
    }
  }
}
