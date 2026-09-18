export const WHATSAPP_NUMBER = '919182301422';

export const COMPANY = {
  name: 'Suvarna IT Enterprises',
  shortName: 'SUVARNA',
  tagline: 'IT ENTERPRISES',
  phone: '+91 91823 01422',
  email: 'sales@suvarnait.com',
  address: 'Shop No. 12, Ground Floor, Tech Park Plaza, MG Road, Bengaluru, Karnataka 560001',
  hours: 'Mon - Sat: 10:00 AM - 8:00 PM',
};

export const formatPrice = (value) =>
  '₹' + Number(value || 0).toLocaleString('en-IN');

export const calcDiscount = (price, oldPrice) =>
  oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;

export const whatsappLink = (message) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const productEnquiryLink = (product) =>
  whatsappLink(
    `Hello Suvarna IT Enterprises, I am interested in "${product.name}" (${formatPrice(
      product.price
    )}). Please share more details.`
  );

const FALLBACK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#071B3D'/><stop offset='1' stop-color='#0D5DB8'/></linearGradient></defs><rect width='600' height='450' fill='url(#g)'/><text x='50%' y='46%' fill='#F59E0B' font-family='Arial, sans-serif' font-size='30' font-weight='bold' text-anchor='middle'>SUVARNA</text><text x='50%' y='58%' fill='#ffffff' font-family='Arial, sans-serif' font-size='14' letter-spacing='4' text-anchor='middle'>IT ENTERPRISES</text></svg>`;

export const FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,' + encodeURIComponent(FALLBACK_SVG);

export const handleImgError = (e) => {
  if (e.currentTarget.src !== FALLBACK_IMAGE) {
    e.currentTarget.src = FALLBACK_IMAGE;
  }
};
