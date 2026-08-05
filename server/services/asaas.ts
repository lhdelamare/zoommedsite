import axios from 'axios';

const getAsaasClient = () => {
  const apiKey = process.env.ASAAS_API_KEY || '';
  const baseURL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

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
      const searchRes = await client.get(`/customers?cpfCnpj=${cleanCpfCnpj}`);
      if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
        return searchRes.data.data[0].id;
      }

      // 2. Create customer if not found
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

      return createRes.data.id;
    } catch (error: any) {
      console.error('Error in Asaas getOrCreateCustomer:', error?.response?.data || error.message);
      throw new Error(
        error?.response?.data?.errors?.[0]?.description ||
          'Falha ao cadastrar/localizar cliente no Asaas.'
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
      // Create single charge or subscription for PIX
      const paymentRes = await client.post('/payments', {
        customer: customerId,
        billingType: 'PIX',
        value: input.value,
        dueDate: new Date().toISOString().split('T')[0],
        description: input.description || `Assinatura Zoommed - ${input.planName}`,
      });

      const paymentId = paymentRes.data.id;

      // Get PIX QR Code details
      const qrCodeRes = await client.get(`/payments/${paymentId}/pixQrCode`);

      return {
        paymentId,
        status: paymentRes.data.status,
        value: paymentRes.data.value,
        dueDate: paymentRes.data.dueDate,
        encodedImage: qrCodeRes.data.encodedImage,
        payload: qrCodeRes.data.payload,
        expirationDate: qrCodeRes.data.expirationDate,
      };
    } catch (error: any) {
      console.error('Error in Asaas createPixCharge:', error?.response?.data || error.message);
      throw new Error(
        error?.response?.data?.errors?.[0]?.description || 'Falha ao gerar cobrança PIX no Asaas.'
      );
    }
  }

  /**
   * Create a transparent Credit Card charge
   */
  static async createCreditCardCharge(input: CreditCardCheckoutInput) {
    const client = getAsaasClient();
    const customerId = await this.getOrCreateCustomer(input.customer);

    try {
      const paymentRes = await client.post('/payments', {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: input.value,
        dueDate: new Date().toISOString().split('T')[0],
        description: input.description || `Assinatura Zoommed - ${input.planName}`,
        creditCard: {
          holderName: input.creditCard.holderName,
          number: input.creditCard.number.replace(/\D/g, ''),
          expiryMonth: input.creditCard.expiryMonth,
          expiryYear: input.creditCard.expiryYear,
          ccv: input.creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: input.creditCardHolderInfo.name,
          email: input.creditCardHolderInfo.email,
          cpfCnpj: input.creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: input.creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: input.creditCardHolderInfo.addressNumber,
          addressComplement: input.creditCardHolderInfo.addressComplement,
          phone: input.creditCardHolderInfo.phone.replace(/\D/g, ''),
        },
      });

      return {
        paymentId: paymentRes.data.id,
        status: paymentRes.data.status,
        value: paymentRes.data.value,
        invoiceUrl: paymentRes.data.invoiceUrl,
      };
    } catch (error: any) {
      console.error('Error in Asaas createCreditCardCharge:', error?.response?.data || error.message);
      throw new Error(
        error?.response?.data?.errors?.[0]?.description || 'Falha ao processar cartão de crédito no Asaas.'
      );
    }
  }

  /**
   * Create a Boleto charge
   */
  static async createBoletoCharge(input: BoletoCheckoutInput) {
    const client = getAsaasClient();
    const customerId = await this.getOrCreateCustomer(input.customer);

    try {
      const paymentRes = await client.post('/payments', {
        customer: customerId,
        billingType: 'BOLETO',
        value: input.value,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: input.description || `Assinatura Zoommed - ${input.planName}`,
      });

      const paymentId = paymentRes.data.id;
      const identificationFieldRes = await client.get(`/payments/${paymentId}/identificationField`);

      return {
        paymentId,
        status: paymentRes.data.status,
        value: paymentRes.data.value,
        dueDate: paymentRes.data.dueDate,
        bankSlipUrl: paymentRes.data.bankSlipUrl,
        identificationField: identificationFieldRes.data.identificationField,
      };
    } catch (error: any) {
      console.error('Error in Asaas createBoletoCharge:', error?.response?.data || error.message);
      throw new Error(
        error?.response?.data?.errors?.[0]?.description || 'Falha ao gerar boleto bancário no Asaas.'
      );
    }
  }

  /**
   * Get Live Payment Status
   */
  static async getPaymentStatus(paymentId: string) {
    const client = getAsaasClient();
    try {
      const res = await client.get(`/payments/${paymentId}`);
      return {
        id: res.data.id,
        status: res.data.status,
        confirmedDate: res.data.confirmedDate,
        paymentDate: res.data.paymentDate,
        value: res.data.value,
      };
    } catch (error: any) {
      console.error('Error fetching payment status:', error?.response?.data || error.message);
      throw new Error('Pagamento não encontrado.');
    }
  }
}
