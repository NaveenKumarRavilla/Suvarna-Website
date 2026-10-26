import { MessageCircle } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

export default function WhatsAppButton() {
  const { settings } = useAdmin();
  const whatsappNumber = String(settings.whatsapp || '').replace(/\D/g, '');
  const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hello ${settings.storeName}, I am interested in your products.`)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-5 right-5 z-50"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-40" aria-hidden="true" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform duration-200 group-hover:scale-110">
        <MessageCircle size={26} />
      </span>
      <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
        Chat with us
      </span>
    </a>
  );
}
