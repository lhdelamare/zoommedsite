import React, { useState, useEffect } from 'react';
import { CheckoutPage, PlanData } from './components/CheckoutPage';

export const App: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<PlanData | null>(null);

  useEffect(() => {
    // Intercept clicks on any subscription/plan buttons
    const handleButtonClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('a, button');

      if (!button) return;

      const text = button.textContent?.toLowerCase() || '';

      if (text.includes('assinar') || text.includes('consultar agora') || text.includes('assine agora')) {
        e.preventDefault();

        // Check if button is inside a specific plan card
        const planCard = button.closest('.plan-card, .plan-featured, .card, [data-plan]');
        let planName = 'Essencial Individual';
        let planPrice = 29.90;
        let planPeriod = 'mês';

        if (planCard) {
          const titleEl = planCard.querySelector('h3, h4, .plan-title, .title');
          const priceEl = planCard.querySelector('.price, .plan-price, strong, b');

          if (titleEl) planName = titleEl.textContent?.trim() || planName;
          if (priceEl) {
            const rawPrice = priceEl.textContent || '';
            const match = rawPrice.match(/\d+[\.,]?\d*/);
            if (match) {
              planPrice = parseFloat(match[0].replace(',', '.'));
            }
          }
        }

        // Hide landing page content when checkout page is active
        const landingRoot = document.getElementById('site-root');
        if (landingRoot) {
          landingRoot.style.display = 'none';
        }

        setSelectedPlan({
          name: planName,
          price: planPrice,
          period: planPeriod,
        });
      }
    };

    document.addEventListener('click', handleButtonClick);
    return () => {
      document.removeEventListener('click', handleButtonClick);
    };
  }, []);

  const handleBackToSite = () => {
    const landingRoot = document.getElementById('site-root');
    if (landingRoot) {
      landingRoot.style.display = 'block';
    }
    setSelectedPlan(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {selectedPlan && (
        <CheckoutPage
          plan={selectedPlan}
          onBack={handleBackToSite}
        />
      )}
    </>
  );
};
