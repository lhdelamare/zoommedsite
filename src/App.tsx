import React, { useState, useEffect } from 'react';
import { CheckoutPage, PlanData } from './components/CheckoutPage';
import { PAGES } from './pagesData';
import { initSiteInteractivity } from './initInteractivity';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const p = window.location.pathname.replace(/\/$/, '') || '/';
    return PAGES[p] ? p : '/';
  });

  const [selectedPlan, setSelectedPlan] = useState<PlanData | null>(null);
  const [dbProducts, setDbProducts] = useState<PlanData[]>([]);

  // Load products catalog from backend/Supabase
  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const mapped: PlanData[] = data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price || 0),
            period: 'mês',
            max_dependents: p.max_dependents || 0,
            product_type: p.product_type || 'plan',
            has_benefits_club: Boolean(p.has_benefits_club),
            match_identifier: p.match_identifier || p.name,
          }));
          setDbProducts(mapped);
        }
      })
      .catch((err) => console.error('Failed to load products from API:', err));
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace(/\/$/, '') || '/';
      setCurrentPath(PAGES[p] ? p : '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Render current page content into #site-root whenever currentPath changes
  useEffect(() => {
    const landingRoot = document.getElementById('site-root');
    if (!landingRoot) return;

    const pageData = PAGES[currentPath] || PAGES['/'];

    if (pageData) {
      landingRoot.innerHTML = pageData.body;
      document.title = pageData.title;
    }

    if (!selectedPlan) {
      landingRoot.style.display = 'block';
    }

    // Re-initialize interactivity (mobile menu, accordions, GSAP, etc.)
    setTimeout(() => {
      initSiteInteractivity();
    }, 50);
  }, [currentPath, selectedPlan]);

  // Global click handler for navigation & checkout buttons
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchorOrBtn = target.closest('a, button') as HTMLElement | null;

      if (!anchorOrBtn) return;

      const text = anchorOrBtn.textContent?.toLowerCase().trim() || '';
      const href = anchorOrBtn.getAttribute('href') || '';

      // Check if button triggers purchase/checkout modal
      const isPurchaseClick = (
        text.includes('assinar') ||
        text.includes('consultar agora') ||
        text.includes('assine agora') ||
        text.includes('comprar agora') ||
        text.includes('quero este') ||
        text.includes('contratar') ||
        text.includes('adquirir') ||
        text.includes('agendar consulta')
      );

      if (isPurchaseClick) {
        e.preventDefault();

        const planCard = anchorOrBtn.closest('.plan-card, .plan-featured, .card, [data-plan], .pricing-card, .service-card, .product-card, .cta-card, .purchase-card, #contratacao, aside, article');
        let planName = '';
        let planPrice = 0;

        if (planCard) {
          const titleEl = planCard.querySelector('h1, h2, h3, h4, .plan-title, .plan-name, .title, .card-title, .purchase-label, .purchase-title');
          const priceEl = planCard.querySelector('.price, .plan-price, .purchase-price, strong, b');

          if (titleEl) planName = titleEl.textContent?.trim() || '';
          if (priceEl) {
            const rawPrice = priceEl.textContent || '';
            const match = rawPrice.match(/\d+[\.,]?\d*/);
            if (match) {
              planPrice = parseFloat(match[0].replace(',', '.'));
            }
          }
        }

        // Context / Route Fallback if button is page-level
        if (!planName || currentPath === '/assistencia-psicologica' || text.includes('psicol')) {
          if (currentPath === '/assistencia-psicologica' || text.includes('psicol')) {
            planName = 'Assistência Psicológica';
            if (planPrice === 0) planPrice = 95.90;
          } else if (currentPath === '/clube-vantagens' || text.includes('clube')) {
            planName = 'Clube+ Vantagens';
            if (planPrice === 0) planPrice = 9.90;
          } else if (currentPath === '/consulta-avulsa') {
            planName = 'Consulta Avulsa - Clínica geral';
            if (planPrice === 0) planPrice = 49.00;
          } else if (!planName) {
            planName = 'Essencial Individual';
            if (planPrice === 0) planPrice = 59.90;
          }
        }

        // Filter valid products from DB with price > 0
        const validDbProducts = dbProducts.filter((p) => p.price > 0);
        const cleanSearch = planName.toLowerCase().trim();

        // 1. Exact match by match_identifier or name
        let matchedDbProduct = validDbProducts.find((p) => {
          const mi = (p.match_identifier || '').toLowerCase().trim();
          const dbName = p.name.toLowerCase().trim();
          return mi === cleanSearch || dbName === cleanSearch;
        });

        // 2. Fuzzy match
        if (!matchedDbProduct) {
          matchedDbProduct = validDbProducts.find((p) => {
            const mi = (p.match_identifier || '').toLowerCase().trim();
            const dbName = p.name.toLowerCase().trim();
            return (
              (mi.length > 3 && cleanSearch.includes(mi)) ||
              (dbName.length > 3 && cleanSearch.includes(dbName)) ||
              (mi.length > 3 && mi.includes(cleanSearch)) ||
              (dbName.length > 3 && dbName.includes(cleanSearch))
            );
          });
        }

        let finalPlan: PlanData = {
          name: planName,
          price: planPrice > 0 ? planPrice : 49.90,
          period: 'mês',
          max_dependents: 0,
        };

        if (matchedDbProduct) {
          finalPlan = {
            ...matchedDbProduct,
            price: matchedDbProduct.price > 0 ? matchedDbProduct.price : (planPrice > 0 ? planPrice : 49.90),
          };
        } else if (cleanSearch.includes('familiar')) {
          finalPlan.max_dependents = 3;
        }

        console.log('🛒 Selected Plan for Checkout:', finalPlan);

        const landingRoot = document.getElementById('site-root');
        if (landingRoot) {
          landingRoot.style.display = 'none';
        }

        setSelectedPlan(finalPlan);
        return;
      }

      // Check if clicking an internal page route link
      if (href && (href.startsWith('/') || href.includes('zommed.netlify.app'))) {
        try {
          const urlObj = new URL(href, window.location.origin);
          const targetPath = urlObj.pathname.replace(/\/$/, '') || '/';

          if (targetPath in PAGES) {
            e.preventDefault();
            if (targetPath !== currentPath) {
              window.history.pushState({}, '', targetPath);
              setCurrentPath(targetPath);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (urlObj.hash) {
              const el = document.querySelector(urlObj.hash);
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
          }
        } catch (err) {
          // Ignore invalid URL parse
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [dbProducts, currentPath]);

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
