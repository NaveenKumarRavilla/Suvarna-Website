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
} from 'lucide-react';

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
  { id: 'accessories', label: 'Accessories', icon: Headphones },
  { id: 'services', label: 'Services', icon: Wrench, path: '/contact' },
  { id: 'refurbished', label: 'Refurbished', icon: RefreshCcw },
  { id: 'offers', label: 'Offers', icon: BadgePercent, special: true },
  { id: 'contact', label: 'Contact', icon: Phone, path: '/contact' },
];

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

export const categoryLabel = (id) =>
  navCategories.find((c) => c.id === id)?.label || 'All Products';
