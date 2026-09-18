const img = (id, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const heroSlides = [
  {
    id: 1,
    badge: 'NEW ARRIVALS',
    title: 'POWER YOUR POSSIBILITIES',
    subtitle: 'Laptops that adapt to you — business, study & creativity.',
    cta: 'SHOP NOW',
    link: '/products?category=laptops',
    image: img('photo-1531297484001-80022131f5a1'),
    gradient: 'from-[#04122B] via-[#071B3D] to-[#0D5DB8]',
  },
  {
    id: 2,
    badge: 'ENTERPRISE READY',
    title: 'BUSINESS TECHNOLOGY',
    subtitle: 'Reliable desktops, servers & solutions for your business.',
    cta: 'EXPLORE NOW',
    link: '/products?category=desktops',
    image: img('photo-1497366216548-37526070297c'),
    gradient: 'from-[#071B3D] via-[#0A2552] to-[#155799]',
  },
  {
    id: 3,
    badge: 'COMPLETE IT ECOSYSTEM',
    title: 'SMART IT SOLUTIONS',
    subtitle: 'Technology that moves your business forward.',
    cta: 'VIEW PRODUCTS',
    link: '/products',
    image: img('photo-1519389950473-47ba0277781c'),
    gradient: 'from-[#0A2552] via-[#0D5DB8] to-[#1B75D0]',
  },
];

export const promoCards = [
  {
    id: 1,
    tag: 'HP LASER PRINTERS',
    title: 'Laser Printers',
    subtitle: 'Fast, reliable office printing',
    cta: 'SHOP NOW',
    link: '/products?category=printers',
    image: img('photo-1612815154858-60aa4c59eaa6', 400),
    gradient: 'from-[#071B3D] to-[#0D5DB8]',
  },
  {
    id: 2,
    tag: 'CCTV SURVEILLANCE',
    title: 'Advanced Security',
    subtitle: 'Complete surveillance solutions',
    cta: 'EXPLORE NOW',
    link: '/products?category=cctv',
    image: img('photo-1557324232-b8917d3c3dcb', 400),
    gradient: 'from-[#7C2D12] to-[#F59E0B]',
  },
  {
    id: 3,
    tag: 'GAMING ZONE',
    title: 'Gaming PCs',
    subtitle: 'High performance gaming rigs',
    cta: 'SHOP NOW',
    link: '/products?category=gaming',
    image: img('photo-1603302576837-37561b2e2302', 400),
    gradient: 'from-[#1E1B4B] to-[#7C3AED]',
  },
];
