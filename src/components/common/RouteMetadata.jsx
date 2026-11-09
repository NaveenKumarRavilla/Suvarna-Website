import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { categoryLabel, normalizeCategoryId } from '../../data/categories';

const SITE_NAME = 'Suvarna IT Enterprises';
const DEFAULT_DESCRIPTION = 'Shop laptops, desktops, servers, printers, CCTV, networking equipment and IT solutions from Suvarna IT Enterprises.';

const setMeta = (selector, attribute, key, content) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const clipDescription = (value) => String(value || DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').trim().slice(0, 160);

export default function RouteMetadata() {
  const { pathname, search } = useLocation();
  const { storefrontProducts, categories, policies } = useAdmin();

  useEffect(() => {
    const params = new URLSearchParams(search);
    let title = `${SITE_NAME} | Laptops, Desktops, Servers & IT Solutions`;
    let description = DEFAULT_DESCRIPTION;
    let canonicalPath = pathname || '/';
    let image = '';
    let product = null;
    let policy = null;

    if (pathname === '/products') {
      const categoryId = normalizeCategoryId(params.get('category') || 'all');
      const category = categories.find((item) => item.id === categoryId);
      const categoryName = category?.label || (categoryId === 'all' ? 'IT Products' : categoryLabel(categoryId));
      title = params.get('offers') === 'true'
        ? `Offers on IT Products | ${SITE_NAME}`
        : `${categoryName} | ${SITE_NAME}`;
      description = `Browse ${categoryName.toLowerCase()} at Suvarna IT Enterprises. Compare product specifications, availability and pricing.`;
      canonicalPath = categoryId === 'all' ? '/products' : `/products?category=${encodeURIComponent(categoryId)}`;
    } else if (pathname.startsWith('/product/')) {
      product = storefrontProducts.find((item) => `/product/${item.id}` === pathname);
      if (product) {
        title = `${product.name} | ${SITE_NAME}`;
        description = clipDescription(product.description || `${product.name} by ${product.brand}, available from Suvarna IT Enterprises.`);
        canonicalPath = `/product/${encodeURIComponent(product.id)}`;
        image = product.images?.[0] || product.image || '';
      } else {
        title = `Product not found | ${SITE_NAME}`;
        description = 'This product is unavailable or may have been removed from the catalogue.';
      }
    } else if (pathname === '/shipping-policy' || pathname === '/policy/shipping') {
      policy = policies.shipping;
      title = `${policy?.title || 'Shipping Policy'} | ${SITE_NAME}`;
      description = clipDescription(policy?.summary || 'Shipping fees, delivery charges, timelines and order delivery information.');
      canonicalPath = '/shipping-policy';
    } else if (pathname === '/') {
      description = 'Shop business laptops, desktops, servers, printers, CCTV, networking equipment and IT services at Suvarna IT Enterprises.';
    }

    const canonicalUrl = `${window.location.origin}${canonicalPath}`;
    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', product ? 'product' : 'website');
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    if (image) {
      const imageUrl = new URL(image, window.location.origin).href;
      setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);
    } else {
      document.head.querySelector('meta[property="og:image"]')?.remove();
      document.head.querySelector('meta[name="twitter:image"]')?.remove();
    }

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    document.head.querySelector('#product-structured-data')?.remove();
    if (product) {
      const schema = document.createElement('script');
      schema.id = 'product-structured-data';
      schema.type = 'application/ld+json';
      schema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description,
        sku: String(product.sku || product.id),
        brand: { '@type': 'Brand', name: product.brand },
        image: image ? [new URL(image, window.location.origin).href] : undefined,
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'INR',
          price: Number(product.price).toFixed(2),
          availability: product.stock === 'Out of Stock' ||
            (product.stock === 'Limited Stock' && (!Number.isInteger(Number(product.stockQuantity)) || Number(product.stockQuantity) < 1))
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
        },
      });
      document.head.appendChild(schema);
    }
  }, [categories, pathname, policies, search, storefrontProducts]);

  return null;
}
