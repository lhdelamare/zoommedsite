import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  QrCode,
  CreditCard,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Loader2,
  ShieldCheck,
  Lock,
  UserPlus,
  Trash2,
  Users,
} from 'lucide-react';

export interface PlanData {
  id?: number;
  name: string;
  price: number;
  period: string;
  max_dependents?: number;
  product_type?: string;
  has_benefits_club?: boolean;
  match_identifier?: string;
}

interface CheckoutPageProps {
  plan: PlanData;
  onBack: () => void;
}

type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

export interface Dependent {
  name: string;
  cpf: string;
  birthDate: string;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ plan, onBack }) => {
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

  // Dependents Form State
  const maxDependents = plan.max_dependents || 0;
  const [dependents, setDependents] = useState<Dependent[]>([]);

  // Credit Card Form State
  const [creditCard, setCreditCard] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
  });

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const handleInvalid = (e: React.FormEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).setCustomValidity('Por favor, preencha este campo.');
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).setCustomValidity('');
  };

  // Helper mask for CPF/CNPJ
  const formatCpfCnpj = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length <= 11) {
      return clean
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return clean
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  // Helper mask for Phone
  const formatPhone = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length <= 10) {
      return clean.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return clean.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
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

  // Dependent Handlers
  const addDependent = () => {
    if (dependents.length < maxDependents) {
      setDependents([...dependents, { name: '', cpf: '', birthDate: '' }]);
    }
  };

  const removeDependent = (index: number) => {
    setDependents(dependents.filter((_, i) => i !== index));
  };

  const handleDependentChange = (index: number, field: keyof Dependent, value: string) => {
    const updated = [...dependents];
    updated[index] = { ...updated[index], [field]: value };
    setDependents(updated);
  };

  // Poll for payment status
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
        dependents,
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
    <div style={pageWrapperStyle}>
      {/* Header Bar */}
      <header style={headerStyle}>
        <div style={headerContentStyle}>
          <button onClick={onBack} style={backButtonStyle}>
            <ArrowLeft size={18} />
            <span>Voltar ao site</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontSize: '13px', fontWeight: 600 }}>
            <Lock size={16} />
            <span>Ambiente 100% Seguro</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={mainContentStyle}>
        <div style={layoutGridStyle}>
          {/* Left Column: Checkout Form */}
          <div style={cardBoxStyle}>
            <h2 style={{ margin: '0 0 8px', color: '#001d42', fontSize: '24px', fontWeight: 800 }}>
              Finalizar Assinatura
            </h2>
            <p style={{ color: '#5e738b', fontSize: '14px', margin: '0 0 24px' }}>
              Preencha os dados abaixo para ativar sua consulta e benefícios online imediatamente.
            </p>

            {error && (
              <div style={errorBannerStyle}>
                <AlertCircle size={20} style={{ minWidth: 20 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Success View for PIX */}
            {successData && paymentMethod === 'PIX' && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                {paymentStatus === 'RECEIVED' || paymentStatus === 'CONFIRMED' ? (
                  <div style={{ padding: '40px 0' }}>
                    <CheckCircle2 size={72} color="#10b981" style={{ margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '24px', color: '#001d42', marginBottom: '8px' }}>Pagamento Confirmado!</h3>
                    <p style={{ color: '#5e738b', margin: '0 0 24px' }}>
                      Sua assinatura do plano <strong>{plan.name}</strong> foi ativada com sucesso no sistema.
                    </p>
                    <button onClick={onBack} style={primaryButtonStyle}>
                      Voltar à página inicial
                    </button>
                  </div>
                ) : (
                  <>
                    <h4 style={{ margin: '0 0 16px', color: '#001d42', fontSize: '18px' }}>Escaneie o QR Code PIX para pagar</h4>
                    {successData.encodedImage && (
                      <img
                        src={`data:image/png;base64,${successData.encodedImage}`}
                        alt="PIX QR Code"
                        style={{ width: '240px', height: '240px', margin: '0 auto 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}
                      />
                    )}

                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', fontSize: '14px', color: '#5e738b', marginBottom: '8px' }}>
                        Ou utilize o código Copia e Cola:
                      </label>
                      <div style={{ display: 'flex', gap: '8px', maxWidth: '500px', margin: '0 auto' }}>
                        <input
                          type="text"
                          readOnly
                          value={successData.payload || ''}
                          style={{ ...inputStyle, flex: 1, fontSize: '13px' }}
                        />
                        <button onClick={copyPixPayload} style={{ ...primaryButtonStyle, marginTop: 0, width: 'auto', padding: '0 20px' }}>
                          {copiedPix ? 'Copiado!' : <><Copy size={16} /> Copiar</>}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#0752a8', fontSize: '15px', padding: '12px', background: '#f0f7ff', borderRadius: '12px' }}>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Aguardando confirmação do pagamento...</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Success View for Credit Card */}
            {successData && paymentMethod === 'CREDIT_CARD' && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <CheckCircle2 size={72} color="#10b981" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '24px', color: '#001d42', marginBottom: '8px' }}>Pagamento Aprovado!</h3>
                <p style={{ color: '#5e738b', margin: '0 0 24px' }}>
                  Sua assinatura do plano <strong>{plan.name}</strong> no valor de R$ {plan.price.toFixed(2).replace('.', ',')} foi aprovada com sucesso.
                </p>
                <button onClick={onBack} style={primaryButtonStyle}>
                  Voltar à página inicial
                </button>
              </div>
            )}

            {/* Success View for Boleto */}
            {successData && paymentMethod === 'BOLETO' && (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <FileText size={56} color="#0752a8" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '22px', color: '#001d42', marginBottom: '8px' }}>Boleto Gerado com Sucesso!</h3>
                <p style={{ color: '#5e738b', fontSize: '15px', marginBottom: '20px' }}>
                  Vencimento: <strong>{successData.dueDate}</strong>
                </p>
                {successData.identificationField && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#5e738b', marginBottom: '6px' }}>Linha Digitável:</label>
                    <code style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', wordBreak: 'break-all', display: 'block' }}>
                      {successData.identificationField}
                    </code>
                  </div>
                )}
                {successData.bankSlipUrl && (
                  <a href={successData.bankSlipUrl} target="_blank" rel="noopener noreferrer" style={{ ...primaryButtonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}>
                    <Download size={20} /> Baixar Boleto PDF
                  </a>
                )}
              </div>
            )}

            {/* Checkout Form */}
            {!successData && (
              <form onSubmit={handleSubmit}>
                <h3 style={{ margin: '0 0 16px', color: '#001d42', fontSize: '17px', fontWeight: 700 }}>
                  1. Dados do Assinante Titular
                </h3>

                <div style={formGridStyle}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Nome Completo *</label>
                    <input
                      type="text"
                      required
                      onInvalid={handleInvalid}
                      onInput={handleInput}
                      placeholder="Nome completo do titular"
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
                      onInvalid={handleInvalid}
                      onInput={handleInput}
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
                      onInvalid={handleInvalid}
                      onInput={handleInput}
                      placeholder="000.000.000-00"
                      value={customer.cpfCnpj}
                      onChange={(e) => handleInputChange('cpfCnpj', formatCpfCnpj(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>E-mail *</label>
                    <input
                      type="email"
                      required
                      onInvalid={handleInvalid}
                      onInput={handleInput}
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
                      onInvalid={handleInvalid}
                      onInput={handleInput}
                      placeholder="(11) 99999-9999"
                      value={customer.phone}
                      onChange={(e) => handleInputChange('phone', formatPhone(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>CEP {loadingCep && <span style={{ color: '#0752a8', fontWeight: 400 }}>(Buscando...)</span>}</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={customer.postalCode}
                      onChange={(e) => handleCepChange(e.target.value)}
                      onBlur={(e) => handleCepChange(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
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
                      onInvalid={handleInvalid}
                      onInput={handleInput}
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

                {/* Dependent Registration Section if max_dependents > 0 */}
                {maxDependents > 0 && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '32px 0 24px' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#001d42', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Users size={20} color="#0752a8" />
                          <span>2. Dependentes (Até {maxDependents} incluídos)</span>
                        </h3>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                          Adicione os familiares que farão parte do seu plano.
                        </p>
                      </div>

                      {dependents.length < maxDependents && (
                        <button
                          type="button"
                          onClick={addDependent}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: 'none',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          <UserPlus size={16} /> Adicionar Dependente
                        </button>
                      )}
                    </div>

                    {dependents.length === 0 ? (
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '14px' }}>
                        Nenhum dependente adicionado ainda. Você pode adicionar até {maxDependents} dependentes agora ou posteriormente no portal.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {dependents.map((dep, idx) => (
                          <div key={idx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: '14px', color: '#001d42' }}>
                                Dependente #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeDependent(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}
                              >
                                <Trash2 size={14} /> Remover
                              </button>
                            </div>

                            <div style={formGridStyle}>
                              <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Nome Completo do Dependente *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Nome do dependente"
                                  value={dep.name}
                                  onChange={(e) => handleDependentChange(idx, 'name', e.target.value)}
                                  style={inputStyle}
                                />
                              </div>

                              <div>
                                <label style={labelStyle}>CPF do Dependente *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="000.000.000-00"
                                  value={dep.cpf}
                                  onChange={(e) => handleDependentChange(idx, 'cpf', formatCpfCnpj(e.target.value))}
                                  style={inputStyle}
                                />
                              </div>

                              <div>
                                <label style={labelStyle}>Data de Nascimento *</label>
                                <input
                                  type="date"
                                  required
                                  value={dep.birthDate}
                                  onChange={(e) => handleDependentChange(idx, 'birthDate', e.target.value)}
                                  style={inputStyle}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '32px 0 24px' }} />

                <h3 style={{ margin: '0 0 16px', color: '#001d42', fontSize: '17px', fontWeight: 700 }}>
                  {maxDependents > 0 ? '3' : '2'}. Forma de Pagamento
                </h3>

                <div style={paymentSelectorGridStyle}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PIX')}
                    style={paymentButtonStyle(paymentMethod === 'PIX')}
                  >
                    <QrCode size={22} />
                    <span>PIX Instantâneo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    style={paymentButtonStyle(paymentMethod === 'CREDIT_CARD')}
                  >
                    <CreditCard size={22} />
                    <span>Cartão de Crédito</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BOLETO')}
                    style={paymentButtonStyle(paymentMethod === 'BOLETO')}
                  >
                    <FileText size={22} />
                    <span>Boleto Bancário</span>
                  </button>
                </div>

                {/* Credit Card Specific Fields */}
                {paymentMethod === 'CREDIT_CARD' && (
                  <div style={creditCardBoxStyle}>
                    <div style={formGridStyle}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Número do Cartão *</label>
                        <input
                          type="text"
                          required
                          onInvalid={handleInvalid}
                          onInput={handleInput}
                          placeholder="0000 0000 0000 0000"
                          value={creditCard.number}
                          onChange={(e) => handleCardChange('number', e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Nome Impresso no Cartão *</label>
                        <input
                          type="text"
                          required
                          onInvalid={handleInvalid}
                          onInput={handleInput}
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
                            onInvalid={handleInvalid}
                            onInput={handleInput}
                            maxLength={2}
                            placeholder="MM"
                            value={creditCard.expiryMonth}
                            onChange={(e) => handleCardChange('expiryMonth', e.target.value)}
                            style={{ ...inputStyle, textAlign: 'center' }}
                          />
                          <input
                            type="text"
                            required
                            onInvalid={handleInvalid}
                            onInput={handleInput}
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
                          onInvalid={handleInvalid}
                          onInput={handleInput}
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

                <button type="submit" disabled={loading} style={primaryButtonStyle}>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} /> Processando cobrança...
                    </>
                  ) : (
                    `Confirmar Assinatura — R$ ${plan.price.toFixed(2).replace('.', ',')}/${plan.period}`
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Order Summary Card */}
          <div>
            <div style={summaryCardStyle}>
              <h3 style={{ margin: '0 0 16px', color: '#001d42', fontSize: '18px', fontWeight: 800 }}>
                Resumo do Pedido
              </h3>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '14px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#001d42', fontSize: '16px' }}>{plan.name}</span>
                  <span style={{ fontWeight: 800, color: '#0752a8', fontSize: '18px' }}>
                    R$ {plan.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Cobrança recorrente {plan.period}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={featureRowStyle}>
                  <ShieldCheck size={18} color="#10b981" />
                  <span>Atendimento médico online 24h</span>
                </div>
                <div style={featureRowStyle}>
                  <ShieldCheck size={18} color="#10b981" />
                  <span>Sem carência, uso imediato</span>
                </div>
                <div style={featureRowStyle}>
                  <ShieldCheck size={18} color="#10b981" />
                  <span>Receitas e atestados digitais</span>
                </div>
                {maxDependents > 0 && (
                  <div style={featureRowStyle}>
                    <ShieldCheck size={18} color="#10b981" />
                    <span>Inclusão de até {maxDependents} dependentes</span>
                  </div>
                )}
                <div style={featureRowStyle}>
                  <ShieldCheck size={18} color="#10b981" />
                  <span>Cancelamento fácil a qualquer momento</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', color: '#001d42', fontWeight: 600 }}>Total hoje:</span>
                <span style={{ fontSize: '22px', color: '#001d42', fontWeight: 800 }}>
                  R$ {plan.price.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Styles for full-page layout
const pageWrapperStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#f3f7fb',
  fontFamily: '"Manrope", sans-serif',
  color: '#0c2f54',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderBottom: '1px solid #e2e8f0',
  position: 'sticky',
  top: 0,
  zIndex: 100,
};

const headerContentStyle: React.CSSProperties = {
  maxWidth: '1180px',
  margin: '0 auto',
  padding: '16px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const backButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'none',
  border: 'none',
  color: '#0752a8',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
  padding: 0,
};

const mainContentStyle: React.CSSProperties = {
  maxWidth: '1180px',
  margin: '0 auto',
  padding: '32px 24px 64px',
};

const layoutGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 380px',
  gap: '32px',
  alignItems: 'start',
};

const cardBoxStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '24px',
  padding: '36px',
  boxShadow: '0 10px 30px rgba(0, 39, 90, 0.05)',
};

const summaryCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '24px',
  padding: '28px',
  boxShadow: '0 10px 30px rgba(0, 39, 90, 0.05)',
  position: 'sticky',
  top: '96px',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const paymentSelectorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px',
  marginBottom: '24px',
};

const paymentButtonStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '16px 12px',
  borderRadius: '14px',
  border: active ? '2px solid #0752a8' : '1px solid #cbd5e1',
  background: active ? '#f0f7ff' : '#ffffff',
  color: active ? '#0752a8' : '#64748b',
  fontWeight: active ? 700 : 600,
  cursor: 'pointer',
  fontSize: '13px',
  textAlign: 'center',
});

const creditCardBoxStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  padding: '20px',
  borderRadius: '16px',
  marginBottom: '24px',
  border: '1px solid #e2e8f0',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, #0752a8 0%, #003e8b 100%)',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '16px',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginTop: '16px',
};

const errorBannerStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#dc2626',
  padding: '14px 18px',
  borderRadius: '12px',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '20px',
};

const featureRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '14px',
  color: '#334155',
};
