import React, { useState, useEffect } from 'react';
import { X, QrCode, CreditCard, FileText, CheckCircle2, AlertCircle, Copy, Download, Loader2 } from 'lucide-react';

export interface PlanData {
  name: string;
  price: number;
  period: string;
}

interface CheckoutModalProps {
  plan: PlanData | null;
  onClose: () => void;
}

type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ plan, onClose }) => {
  if (!plan) return null;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('PENDING');
  const [loadingCep, setLoadingCep] = useState(false);

  // Customer Form State
  const [customer, setCustomer] = useState({
    name: '',
    cpfCnpj: '',
    email: '',
    birthDate: '',
    phone: '',
    postalCode: '',
    address: '',
    addressNumber: '',
    complement: '',
    province: '',
    city: '',
    state: '',
  });

  // Credit Card Form State
  const [creditCard, setCreditCard] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const handleCepChange = async (value: string) => {
    handleInputChange('postalCode', value);
    const cleanCep = value.replace(/\D/g, '');

    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setCustomer((prev) => ({
            ...prev,
            address: data.logradouro || prev.address,
            province: data.bairro || prev.province,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      } catch (e) {
        console.error('Erro ao buscar CEP:', e);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleCardChange = (field: string, value: string) => {
    setCreditCard((prev) => ({ ...prev, [field]: value }));
  };

  // Poll for payment confirmation if PIX or Boleto created
  useEffect(() => {
    let interval: any = null;

    if (successData?.paymentId && (paymentStatus === 'PENDING' || paymentStatus === 'AWAITING_RISK_ANALYSIS')) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/checkout/status/${successData.paymentId}`);
          const data = await res.json();
          if (data.success && data.data?.status) {
            setPaymentStatus(data.data.status);
            if (data.data.status === 'RECEIVED' || data.data.status === 'CONFIRMED') {
              clearInterval(interval);
            }
          }
        } catch (e) {
          console.error('Error polling status:', e);
        }
      }, 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [successData, paymentStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessData(null);

    try {
      let endpoint = '/api/checkout/pix';
      let payload: any = {
        customer,
        planName: plan.name,
        value: plan.price,
      };

      if (paymentMethod === 'CREDIT_CARD') {
        endpoint = '/api/checkout/creditcard';
        payload.creditCard = creditCard;
        payload.creditCardHolderInfo = {
          name: creditCard.holderName || customer.name,
          email: customer.email,
          cpfCnpj: customer.cpfCnpj,
          postalCode: customer.postalCode || '00000000',
          addressNumber: customer.addressNumber || 'S/N',
          phone: customer.phone || '11999999999',
        };
      } else if (paymentMethod === 'BOLETO') {
        endpoint = '/api/checkout/boleto';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Ocorreu um erro no processamento do pagamento.');
      }

      setSuccessData(result.data);
      if (result.data.status) {
        setPaymentStatus(result.data.status);
      }
    } catch (err: any) {
      setError(err.message || 'Falha na conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const copyPixPayload = () => {
    if (successData?.payload) {
      navigator.clipboard.writeText(successData.payload);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContainerStyle}>
        {/* Header */}
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#001d42', fontWeight: 800 }}>
              Checkout Transparente
            </h3>
            <span style={{ fontSize: '14px', color: '#5e738b' }}>
              Plano <strong>{plan.name}</strong> — R$ {plan.price.toFixed(2).replace('.', ',')}/{plan.period}
            </span>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={errorBannerStyle}>
            <AlertCircle size={18} style={{ minWidth: 18 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success View for PIX */}
        {successData && paymentMethod === 'PIX' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {paymentStatus === 'RECEIVED' || paymentStatus === 'CONFIRMED' ? (
              <div style={{ padding: '30px 0' }}>
                <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '22px', color: '#001d42', marginBottom: '8px' }}>Pagamento Confirmado!</h3>
                <p style={{ color: '#5e738b', margin: 0 }}>Sua assinatura do plano <strong>{plan.name}</strong> foi ativada com sucesso.</p>
              </div>
            ) : (
              <>
                <h4 style={{ margin: '0 0 12px', color: '#001d42' }}>Escaneie o QR Code abaixo para pagar via PIX</h4>
                {successData.encodedImage ? (
                  <img
                    src={`data:image/png;base64,${successData.encodedImage}`}
                    alt="PIX QR Code"
                    style={{ width: '220px', height: '220px', margin: '0 auto 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                ) : null}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#5e738b', marginBottom: '6px' }}>
                    Ou utilize o código Copia e Cola:
                  </label>
                  <div style={{ display: 'flex', gap: '8px', maxWidth: '440px', margin: '0 auto' }}>
                    <input
                      type="text"
                      readOnly
                      value={successData.payload || ''}
                      style={{ ...inputStyle, flex: 1, fontSize: '12px' }}
                    />
                    <button onClick={copyPixPayload} style={primaryButtonStyle}>
                      {copiedPix ? 'Copiado!' : <><Copy size={16} /> Copiar</>}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#0752a8', fontSize: '14px', marginTop: '16px' }}>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Aguardando confirmação do pagamento...</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Success View for Credit Card */}
        {successData && paymentMethod === 'CREDIT_CARD' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '22px', color: '#001d42', marginBottom: '8px' }}>Pagamento Aprovado!</h3>
            <p style={{ color: '#5e738b', margin: 0 }}>
              Sua assinatura do plano <strong>{plan.name}</strong> no valor de R$ {plan.price.toFixed(2).replace('.', ',')} foi efetuada com sucesso.
            </p>
          </div>
        )}

        {/* Success View for Boleto */}
        {successData && paymentMethod === 'BOLETO' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <FileText size={48} color="#0752a8" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', color: '#001d42', marginBottom: '8px' }}>Boleto Gerado com Sucesso!</h3>
            <p style={{ color: '#5e738b', fontSize: '14px', marginBottom: '16px' }}>
              Vencimento: {successData.dueDate}
            </p>
            {successData.identificationField && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#5e738b', marginBottom: '4px' }}>Linha Digitável:</label>
                <code style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', wordBreak: 'break-all' }}>
                  {successData.identificationField}
                </code>
              </div>
            )}
            {successData.bankSlipUrl && (
              <a href={successData.bankSlipUrl} target="_blank" rel="noopener noreferrer" style={{ ...primaryButtonStyle, display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                <Download size={18} /> Baixar Boleto PDF
              </a>
            )}
          </div>
        )}

        {/* Form View (when no success yet) */}
        {!successData && (
          <form onSubmit={handleSubmit}>
            {/* Step 1: Customer Data */}
            <h4 style={{ margin: '0 0 12px', color: '#001d42', fontSize: '15px' }}>1. Seus Dados Pessoais</h4>
            <div style={gridTwoStyle}>
              <div>
                <label style={labelStyle}>Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome de quem vai usar"
                  value={customer.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Data de Nascimento *</label>
                <input
                  type="date"
                  required
                  value={customer.birthDate}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>CPF / CNPJ *</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={customer.cpfCnpj}
                  onChange={(e) => handleInputChange('cpfCnpj', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>E-mail *</label>
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={customer.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Celular / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  placeholder="(11) 99999-9999"
                  value={customer.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>CEP {loadingCep && <span style={{ color: '#0752a8', fontWeight: 400 }}>(Buscando endereço...)</span>}</label>
                <input
                  type="text"
                  placeholder="00000-000"
                  value={customer.postalCode}
                  onChange={(e) => handleCepChange(e.target.value)}
                  onBlur={(e) => handleCepChange(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Endereço (Rua / Avenida)</label>
                <input
                  type="text"
                  placeholder="Nome da rua ou avenida"
                  value={customer.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Número *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 123"
                  value={customer.addressNumber}
                  onChange={(e) => handleInputChange('addressNumber', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Complemento</label>
                <input
                  type="text"
                  placeholder="Apto, Bloco, etc."
                  value={customer.complement}
                  onChange={(e) => handleInputChange('complement', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Bairro</label>
                <input
                  type="text"
                  placeholder="Bairro"
                  value={customer.province}
                  onChange={(e) => handleInputChange('province', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Cidade / UF</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={customer.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="UF"
                    value={customer.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    style={{ ...inputStyle, width: '60px', textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Payment Method Choice */}
            <h4 style={{ margin: '20px 0 12px', color: '#001d42', fontSize: '15px' }}>2. Forma de Pagamento</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                style={paymentMethodButtonStyle(paymentMethod === 'PIX')}
              >
                <QrCode size={20} />
                <span>PIX (Aprovação Instantânea)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                style={paymentMethodButtonStyle(paymentMethod === 'CREDIT_CARD')}
              >
                <CreditCard size={20} />
                <span>Cartão de Crédito</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('BOLETO')}
                style={paymentMethodButtonStyle(paymentMethod === 'BOLETO')}
              >
                <FileText size={20} />
                <span>Boleto Bancário</span>
              </button>
            </div>

            {/* Credit Card Specific Fields */}
            {paymentMethod === 'CREDIT_CARD' && (
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                <div style={gridTwoStyle}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Número do Cartão *</label>
                    <input
                      type="text"
                      required
                      placeholder="0000 0000 0000 0000"
                      value={creditCard.number}
                      onChange={(e) => handleCardChange('number', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Nome Impresso no Cartão *</label>
                    <input
                      type="text"
                      required
                      placeholder="COMO ESTÁ NO CARTÃO"
                      value={creditCard.holderName}
                      onChange={(e) => handleCardChange('holderName', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Validade (Mês/Ano) *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        placeholder="MM"
                        value={creditCard.expiryMonth}
                        onChange={(e) => handleCardChange('expiryMonth', e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center' }}
                      />
                      <input
                        type="text"
                        required
                        maxLength={4}
                        placeholder="AAAA"
                        value={creditCard.expiryYear}
                        onChange={(e) => handleCardChange('expiryYear', e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>CVV (Código de Segurança) *</label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      placeholder="123"
                      value={creditCard.ccv}
                      onChange={(e) => handleCardChange('ccv', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" disabled={loading} style={primaryButtonStyle}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Processando cobrança...
                </>
              ) : (
                `Pagar R$ ${plan.price.toFixed(2).replace('.', ',')} com ${paymentMethod === 'PIX' ? 'PIX' : paymentMethod === 'CREDIT_CARD' ? 'Cartão' : 'Boleto'}`
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// Inline Styles for crisp look
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 29, 66, 0.65)',
  backdropFilter: 'blur(6px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
};

const modalContainerStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '24px',
  maxWidth: '620px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: '28px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  position: 'relative',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '20px',
  paddingBottom: '16px',
  borderBottom: '1px solid #e2e8f0',
};

const closeButtonStyle: React.CSSProperties = {
  background: '#f1f5f9',
  border: 'none',
  borderRadius: '50%',
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#64748b',
};

const gridTwoStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const paymentMethodButtonStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '12px 8px',
  borderRadius: '12px',
  border: active ? '2px solid #0752a8' : '1px solid #cbd5e1',
  background: active ? '#f0f7ff' : '#ffffff',
  color: active ? '#0752a8' : '#64748b',
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
  fontSize: '12px',
  textAlign: 'center',
});

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #0752a8 0%, #003e8b 100%)',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: '16px',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginTop: '12px',
};

const errorBannerStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#dc2626',
  padding: '12px 16px',
  borderRadius: '10px',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '16px',
};
