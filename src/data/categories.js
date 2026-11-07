import {
  Home,
  Laptop,
  Monitor,
  Server,
  Printer,
  Cctv,
  Network,
  Cable,
  HardDrive,
  Gamepad2,
  Headphones,
  Wrench,
  RefreshCcw,
  BadgePercent,
  Phone,
  Package,
} from 'lucide-react';

export const categoryIconMap = {
  Laptop,
  Monitor,
  Server,
  Printer,
  Cctv,
  Network,
  Cable,
  HardDrive,
  Gamepad2,
  Headphones,
  Wrench,
  RefreshCcw,
  Package,
};

const categoryIconKeys = {
  laptops: 'Laptop',
  desktops: 'Monitor',
  servers: 'Server',
  printers: 'Printer',
  cctv: 'Cctv',
  networking: 'Network',
  'fiber-optics': 'Cable',
  storage: 'HardDrive',
  gaming: 'Gamepad2',
  peripherals: 'Headphones',
  accessories: 'Headphones',
  services: 'Wrench',
  refurbished: 'RefreshCcw',
};

export const navCategories = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'laptops', label: 'Laptops', icon: Laptop },
  { id: 'desktops', label: 'Desktops', icon: Monitor },
  { id: 'servers', label: 'Servers', icon: Server },
  { id: 'printers', label: 'Printers', icon: Printer },
  { id: 'cctv', label: 'CCTV', icon: Cctv },
  { id: 'networking', label: 'Networking', icon: Network },
  { id: 'fiber-optics', label: 'Fiber Optics', icon: Cable },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'peripherals', label: 'Peripherals', icon: Headphones },
  { id: 'accessories', label: 'Accessories', icon: Headphones },
  { id: 'services', label: 'Services', icon: Wrench, path: '/services' },
  { id: 'refurbished', label: 'Refurbished', icon: RefreshCcw },
  { id: 'offers', label: 'Offers', icon: BadgePercent, special: true },
  { id: 'contact', label: 'Contact', icon: Phone, path: '/contact' },
];

export const navIconFiles = {
  home: 'home.png',
  laptops: 'laptops.png',
  desktops: 'desktops.png',
  servers: 'servers.png',
  printers: 'printers.png',
  cctv: 'cctv.png',
  networking: 'networking.png',
  'fiber-optics': 'fiber-optics.png',
  storage: 'storage.png',
  gaming: 'gaming.png',
  peripherals: 'peripherals.png',
  accessories: 'accessories.png',
  refurbished: 'refurbished.png',
  services: 'services.png',
  offers: 'offers.png',
  contact: 'contact.png',
};

export const getVisibleNavigationCategories = (categories) => {
  const fixedItems = new Map(navCategories.map((category) => [category.id, category]));
  const categoryOrder = new Map(
    navCategories.map((category, index) => [category.id, index])
  );
  const availableCategories = categories
    .filter((category) => !['home', 'services', 'offers', 'contact'].includes(category.id))
    .map((category) => ({
      ...category,
      icon: categoryIconMap[category.iconKey] || categoryIconMap.Package,
    }))
    .sort((left, right) =>
      (categoryOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );

  return [
    fixedItems.get('home'),
    ...availableCategories,
    fixedItems.get('services'),
    fixedItems.get('offers'),
    fixedItems.get('contact'),
  ];
};

export const gridCategories = [
  {
    id: 'laptops',
    label: 'Laptops',
    icon: Laptop,
    gradient: 'from-blue-500 to-indigo-600',
    tagline: 'Business & Personal',
  },
  {
    id: 'desktops',
    label: 'Desktops',
    icon: Monitor,
    gradient: 'from-cyan-500 to-blue-600',
    tagline: 'Workstations & AIO',
  },
  {
    id: 'servers',
    label: 'Servers',
    icon: Server,
    gradient: 'from-slate-600 to-slate-800',
    tagline: 'Enterprise Power',
  },
  {
    id: 'printers',
    label: 'Printers',
    icon: Printer,
    gradient: 'from-emerald-500 to-teal-600',
    tagline: 'Laser & Inkjet',
  },
  {
    id: 'cctv',
    label: 'CCTV',
    icon: Cctv,
    gradient: 'from-rose-500 to-red-600',
    tagline: 'Security Solutions',
  },
  {
    id: 'networking',
    label: 'Networking',
    icon: Network,
    gradient: 'from-violet-500 to-purple-600',
    tagline: 'Routers & Switches',
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: HardDrive,
    gradient: 'from-amber-500 to-orange-600',
    tagline: 'SSD, HDD & NAS',
  },
  {
    id: 'accessories',
    label: 'Accessories',
    icon: Headphones,
    gradient: 'from-pink-500 to-fuchsia-600',
    tagline: 'Peripherals & More',
  },
];

export const defaultManagedCategories = [
  ...gridCategories.map(({ icon, ...category }) => ({
    ...category,
    iconKey: categoryIconKeys[category.id] || 'Package',
  })),
  ...navCategories
    .filter((category) => !category.path && !category.special && !gridCategories.some((item) => item.id === category.id))
    .map((category) => ({
      id: category.id,
      label: category.label,
      tagline: '',
      gradient: 'from-slate-600 to-slate-800',
      iconKey: categoryIconKeys[category.id] || 'Package',
    })),
];

export const normalizeCategoryId = (value = '') =>
  String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

export const categoryLabel = (id) =>
  navCategories.find((c) => c.id === normalizeCategoryId(id))?.label ||
  (id && id !== 'all'
    ? String(id).trim().replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'All Products');
