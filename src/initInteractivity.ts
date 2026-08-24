export function initSiteInteractivity() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Immediately ensure all text and reveal elements are 100% visible
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .hero-reveal, .hero-visual').forEach(el => {
    (el as HTMLElement).style.opacity = '1';
    (el as HTMLElement).style.transform = 'none';
  });

  // Mobile menu
  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  
  if (menuButton && mobileMenu) {
    const mobileLinks = mobileMenu.querySelectorAll('a');
    function setMenu(open: boolean) {
      mobileMenu?.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      menuButton?.setAttribute('aria-expanded', String(open));
      mobileMenu?.setAttribute('aria-hidden', String(!open));
    }

    const newMenuButton = menuButton.cloneNode(true) as HTMLElement;
    menuButton.parentNode?.replaceChild(newMenuButton, menuButton);
    newMenuButton.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));

    mobileLinks.forEach(link => {
      link.addEventListener('click', () => setMenu(false));
    });
  }

  // Dropdown toggle
  const dropdownToggle = document.querySelector('.nav-dropdown-toggle');
  const dropdownMenu = document.querySelector('.nav-dropdown-menu');
  if (dropdownToggle && dropdownMenu) {
    dropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdownMenu.classList.toggle('open');
      dropdownToggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('open');
      dropdownToggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Pricing filter
  const filterButtons = document.querySelectorAll('.toggle-btn');
  const planCards = document.querySelectorAll('.plan-card');
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const filter = (button as HTMLElement).dataset.filter;
      planCards.forEach(card => {
        const category = (card as HTMLElement).dataset.category;
        const visible = filter === 'all' || category === filter;
        (card as HTMLElement).style.display = visible ? 'flex' : 'none';
      });
    });
  });

  // Hero parallax
  const heroVisual = document.getElementById('heroVisual');
  if (heroVisual && !reducedMotion && window.innerWidth > 860) {
    heroVisual.addEventListener('mousemove', (event: MouseEvent) => {
      const rect = heroVisual.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      heroVisual.querySelectorAll('[data-depth]').forEach(el => {
        const depth = Number((el as HTMLElement).dataset.depth || 0.05);
        (el as HTMLElement).style.translate = `${x * depth * 180}px ${y * depth * 180}px`;
      });
    });
    heroVisual.addEventListener('mouseleave', () => {
      heroVisual.querySelectorAll('[data-depth]').forEach(el => (el as HTMLElement).style.removeProperty('translate'));
    });
  }

  // Add 3D tilt to cards
  if (!reducedMotion && window.innerWidth > 860) {
    document.querySelectorAll('.bento-card, .service-card, .plan-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const mouseEvent = e as MouseEvent;
        const rect = (card as HTMLElement).getBoundingClientRect();
        const px = (mouseEvent.clientX - rect.left) / rect.width - 0.5;
        const py = (mouseEvent.clientY - rect.top) / rect.height - 0.5;
        (card as HTMLElement).style.transform = `perspective(900px) rotateX(${-py * 4}deg) rotateY(${px * 4}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => (card as HTMLElement).style.removeProperty('transform'));
    });
  }
}
