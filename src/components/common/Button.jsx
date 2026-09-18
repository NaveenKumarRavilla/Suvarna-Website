import { Link } from 'react-router-dom';

const variants = {
  primary: 'bg-primary text-white hover:bg-navy-700',
  secondary: 'bg-secondary text-white hover:bg-blue-700',
  accent: 'bg-accent font-semibold text-navy-900 hover:bg-accent-dark hover:text-white',
  outline: 'border border-primary text-primary hover:bg-primary hover:text-white',
  'outline-white': 'border border-white/60 text-white hover:bg-white hover:text-primary',
  whatsapp: 'bg-[#25D366] text-white hover:bg-[#1DA851]',
  ghost: 'text-primary hover:bg-slate-100',
  white: 'bg-white text-primary hover:bg-slate-100',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-sm sm:text-base',
  icon: 'p-2',
};

export function buttonClasses(variant = 'primary', size = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${extra}`;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  className = '',
  children,
  ...props
}) {
  const cls = buttonClasses(variant, size, className);
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...props}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
