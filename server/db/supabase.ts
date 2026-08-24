import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://udptgogeyyobegosptqg.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_kUuGN3B02YEOr4hjN_dzlg_Pch394_j';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in process.env, using default staging URL.');
}

// Service Role Supabase client to bypass RLS for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface CustomerData {
  id: string; // Asaas Customer ID (cus_...)
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
  birthDate?: string;
}

export interface DependentInput {
  name: string;
  cpf: string;
  birthDate: string;
  relationship?: string;
}

export interface SubscriptionPaymentRecord {
  paymentId: string;
  subscriptionId?: string;
  customerId: string;
  value: number;
  netValue?: number;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  status: string;
  dueDate: string;
  description?: string;
  planName: string;
  isSubscription?: boolean;
}

export class DatabaseService {
  /**
   * Get product catalog from Supabase 'products' table
   */
  static async getProductsCatalog() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching products from Supabase:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Exception fetching products catalog:', e);
      return [];
    }
  }

  /**
   * Upsert customer in Supabase 'customers' table
   */
  static async upsertCustomer(customer: CustomerData) {
    const cleanCpf = customer.cpfCnpj.replace(/\D/g, '');
    const cleanPhone = (customer.mobilePhone || customer.phone || '').replace(/\D/g, '');
    const cleanZip = (customer.postalCode || '').replace(/\D/g, '');

    const record = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: cleanPhone,
      mobile_phone: cleanPhone,
      cpf_cnpj: cleanCpf,
      postal_code: cleanZip,
      address: customer.address,
      address_number: customer.addressNumber,
      complement: customer.complement,
      province: customer.province,
      city: customer.city,
      state: customer.state,
      birthday: customer.birthDate || null,
      is_asaas: true,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('customers')
        .upsert(record, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('Error upserting customer in Supabase:', error);
      } else {
        console.log(`✅ Customer ${customer.id} (${customer.name}) synced with Supabase.`);
      }
      return data;
    } catch (e) {
      console.error('Exception upserting customer:', e);
      return null;
    }
  }

  /**
   * Save Subscription and Payment in Supabase
   */
  static async saveSubscriptionAndPayment(record: SubscriptionPaymentRecord) {
    try {
      // 1. If it's a subscription (recurrent), upsert into 'subscriptions'
      if (record.subscriptionId || record.isSubscription) {
        const subId = record.subscriptionId || `sub_web_${record.paymentId}`;
        const subData = {
          id: subId,
          customer_id: record.customerId,
          value: record.value,
          billing_type: record.billingType,
          status: record.status || 'ACTIVE',
          cycle: 'MONTHLY',
          description: record.description || record.planName,
          updated_at: new Date().toISOString(),
        };

        const { error: subErr } = await supabase
          .from('subscriptions')
          .upsert(subData, { onConflict: 'id' });

        if (subErr) {
          console.error('Error upserting subscription in Supabase:', subErr);
        } else {
          console.log(`✅ Subscription ${subId} saved in Supabase.`);
        }
      }

      // 2. Upsert payment into 'payments' table
      const paymentData = {
        id: record.paymentId,
        customer_id: record.customerId,
        subscription_id: record.subscriptionId || null,
        value: record.value,
        net_value: record.netValue || record.value,
        billing_type: record.billingType,
        status: record.status || 'PENDING',
        due_date: record.dueDate || new Date().toISOString().split('T')[0],
        description: record.description || record.planName,
        updated_at: new Date().toISOString(),
      };

      const { error: payErr } = await supabase
        .from('payments')
        .upsert(paymentData, { onConflict: 'id' });

      if (payErr) {
        console.error('Error upserting payment in Supabase:', payErr);
      } else {
        console.log(`✅ Payment ${record.paymentId} saved in Supabase.`);
      }
    } catch (e) {
      console.error('Exception saving subscription/payment:', e);
    }
  }

  /**
   * Save Beneficiaries (Holder + Dependents) in Supabase 'beneficiaries' table
   */
  static async saveBeneficiaries(
    customer: CustomerData,
    dependents: DependentInput[] = [],
    paymentType: 'S' | 'A' = 'S'
  ) {
    try {
      const cleanHolderCpf = customer.cpfCnpj.replace(/\D/g, '');
      const cleanPhone = (customer.mobilePhone || customer.phone || '').replace(/\D/g, '');
      const cleanZip = (customer.postalCode || '').replace(/\D/g, '');

      // 1. Upsert Holder (Titular)
      const holderBeneficiary = {
        name: customer.name,
        cpf: cleanHolderCpf,
        birthday: customer.birthDate || new Date().toISOString().split('T')[0],
        email: customer.email,
        phone: cleanPhone,
        zip_code: cleanZip,
        address: customer.address ? `${customer.address}, ${customer.addressNumber || ''}` : null,
        city: customer.city,
        state: customer.state,
        payment_type: paymentType,
        service_type: 'G',
        holder_cpf: null, // null indicates main holder
        status: 'ACTIVE',
        customer_id: customer.id,
        updated_at: new Date().toISOString(),
      };

      const { error: holderErr } = await supabase
        .from('beneficiaries')
        .upsert(holderBeneficiary, { onConflict: 'cpf' });

      if (holderErr) {
        console.error('Error saving holder beneficiary in Supabase:', holderErr);
      } else {
        console.log(`✅ Holder beneficiary (${customer.name}) saved in Supabase.`);
      }

      // 2. Insert Dependents
      if (dependents && dependents.length > 0) {
        for (const dep of dependents) {
          if (!dep.name || !dep.cpf || !dep.birthDate) continue;
          const cleanDepCpf = dep.cpf.replace(/\D/g, '');

          const depBeneficiary = {
            name: dep.name,
            cpf: cleanDepCpf,
            birthday: dep.birthDate,
            email: customer.email, // fallback to holder email
            phone: cleanPhone,
            zip_code: cleanZip,
            address: customer.address ? `${customer.address}, ${customer.addressNumber || ''}` : null,
            city: customer.city,
            state: customer.state,
            payment_type: paymentType,
            service_type: 'G',
            holder_cpf: cleanHolderCpf,
            status: 'ACTIVE',
            customer_id: customer.id,
            updated_at: new Date().toISOString(),
          };

          const { error: depErr } = await supabase
            .from('beneficiaries')
            .upsert(depBeneficiary, { onConflict: 'cpf' });

          if (depErr) {
            console.error(`Error saving dependent ${dep.name} in Supabase:`, depErr);
          } else {
            console.log(`✅ Dependent (${dep.name}) saved for holder ${cleanHolderCpf}.`);
          }
        }
      }
    } catch (e) {
      console.error('Exception saving beneficiaries:', e);
    }
  }
}
