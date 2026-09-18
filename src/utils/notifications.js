import { COMPANY, WHATSAPP_NUMBER } from './helpers';

export const DEFAULT_NOTIFICATION_EMAIL = 'ravillanaveen1996@gmail.com';
export const DEFAULT_NOTIFICATION_WHATSAPP = WHATSAPP_NUMBER;
export const NOTIFICATION_LOG_KEY = 'suvarna_notification_log';
export const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax';

try {
  localStorage.removeItem(NOTIFICATION_LOG_KEY);
} catch {
  // ignore storage restrictions
}

const sanitizePhone = (phone = '') => {
  if (!phone) return '';
  return String(phone).replace(/[^+\d]/g, '').trim();
};

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();

const capitalizeWords = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());

const normalizeFieldValue = (value = '') => {
  if (!value && value !== 0) return 'Not Provided';
  return String(value).trim();
};

const renderEnquiryDetailTable = (enquiry) => {
  const rows = [
    ['Name', normalizeFieldValue(enquiry.name || 'Guest')],
    ['Email', normalizeFieldValue(enquiry.email || 'Not Provided')],
    ['Phone', normalizeFieldValue(enquiry.phone || 'Not Provided')],
    ['Subject', normalizeFieldValue(enquiry.subject || 'General Enquiry')],
    ['Message', normalizeFieldValue(enquiry.message || 'Not Provided')],
  ];

  const leftWidth = Math.max(...rows.map((row) => row[0].length));
  const separator = '-'.repeat(leftWidth + 3 + 46);

  return [
    `${'Field'.padEnd(leftWidth)} | Value`,
    separator,
    ...rows.map(([key, value]) => `${capitalizeWords(key).padEnd(leftWidth)} | ${value}`),
  ].join('\n');
};

const renderOrderItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return 'No product details available.';

  return items.map((item) => {
    return `- ${item.name || 'Product'} x ${item.qty || 1} = ₹${Number(item.price || 0).toLocaleString('en-IN')}`;
  }).join('\n');
};

const buildOrderStoreEmailBody = (order) => [
  '========================================',
  'Suvarna IT Enterprises - Order Notification',
  '========================================',
  '',
  `Order ID: ${order.id || 'SIE'}`,
  `Customer: ${order.customer || 'Guest'}`,
  `Customer Email: ${order.email || 'Not provided'}`,
  `Customer Phone: ${order.phone || 'Not provided'}`,
  `Payment Method: ${order.payment || 'Not selected'}`,
  `Order Date: ${order.date || new Date().toISOString().slice(0, 10)}`,
  `Total Amount: ₹${Number(order.total || 0).toLocaleString('en-IN')}`,
  '',
  'Products:',
  renderOrderItems(order.items),
  '',
  'Receiver Email: ravillanaveen1996@gmail.com',
  'Receiver WhatsApp: 919182301422',
  '',
  'Store: Suvarna IT Enterprises',
].join('\n');

const buildOrderCustomerReplyBody = (order) => [
  '========================================',
  'Suvarna IT Enterprises - Order Confirmation',
  '========================================',
  '',
  `Hello ${order.customer || 'Customer'},`,
  '',
  'Thank you for placing your order with Suvarna IT Enterprises.',
  'Our team will contact you shortly to confirm your order and delivery details.',
  '',
  `Order ID: ${order.id || 'SIE'}`,
  `Order Date: ${order.date || new Date().toISOString().slice(0, 10)}`,
  `Payment Method: ${order.payment || 'Not selected'}`,
  `Total Amount: ₹${Number(order.total || 0).toLocaleString('en-IN')}`,
  '',
  'Products:',
  renderOrderItems(order.items),
  '',
  'Regards,',
  'Suvarna IT Enterprises',
].join('\n');

const buildEnquiryStoreEmailBody = (enquiry) => [
  '========================================',
  'Suvarna IT Enterprises - Enquiry Notification',
  '========================================',
  '',
  'Enquiry Details:',
  renderEnquiryDetailTable(enquiry),
  '',
  'Receiver Email: ravillanaveen1996@gmail.com',
  'Receiver WhatsApp: Email-only route',
  '',
  'Store: Suvarna IT Enterprises',
].join('\n');

const buildEnquiryCustomerReplyBody = (enquiry) => [
  '========================================',
  'Suvarna IT Enterprises - Enquiry Received',
  '========================================',
  '',
  `Hello ${capitalizeWords(enquiry.name || 'Customer')},`,
  '',
  'Thank you for contacting Suvarna IT Enterprises.',
  `We have received your enquiry about: ${capitalizeWords(enquiry.subject || 'General Enquiry')}.`,
  '',
  'Your submitted enquiry details:',
  renderEnquiryDetailTable(enquiry),
  '',
  'Our team will get back to you within 24 hours.',
  '',
  'Regards,',
  'Suvarna IT Enterprises',
].join('\n');

export const buildOrderNotificationPayload = (order) => {
  const productNames = Array.isArray(order.items)
    ? order.items.map((item) => `${item.name || 'Product'} x ${item.qty || 1}`).join(', ')
    : 'Product order';

  const customerEmail = normalizeEmail(order.email || 'Not provided');
  const customerPhone = sanitizePhone(order.phone || 'Not provided');

  return {
    id: `notification-${Date.now()}-${Math.round(Math.random() * 9999)}`,
    type: 'order',
    title: `Order ${order.id || 'SIE'} placed`,
    summary: `Customer ${order.customer || 'Guest'} placed an order for ${order.items?.length || 0} product${(order.items?.length || 0) === 1 ? '' : 's'}.`,
    sender: {
      email: customerEmail,
      phone: customerPhone,
      name: order.customer || 'Guest',
    },
    emailRecipient: DEFAULT_NOTIFICATION_EMAIL,
    whatsappRecipient: DEFAULT_NOTIFICATION_WHATSAPP,
    emailBody: buildOrderStoreEmailBody(order),
    replyEmailRecipient: customerEmail === 'not provided' ? '' : customerEmail,
    replyEmailSubject: `Order Confirmation - ${order.id || 'SIE'}`,
    replyEmailBody: buildOrderCustomerReplyBody(order),
    whatsappMessage: `New order ${order.id || 'SIE'} from ${order.customer || 'Guest'} (${customerEmail}) with phone ${customerPhone}. Products: ${productNames}. Total: ₹${Number(order.total || 0).toLocaleString('en-IN')}.`,
    createdAt: new Date().toISOString(),
  };
};

export const buildEnquiryNotificationPayload = (enquiry) => {
  const customerPhone = sanitizePhone(enquiry.phone || 'Not provided');
  const customerEmail = normalizeEmail(enquiry.email || 'Not provided');

  return {
    id: `notification-${Date.now()}-${Math.round(Math.random() * 9999)}`,
    type: 'enquiry',
    title: 'New enquiry received',
    summary: `New enquiry from ${enquiry.name || 'Guest'}`,
    sender: {
      email: customerEmail,
      phone: customerPhone,
      name: enquiry.name || 'Guest',
    },
    emailRecipient: DEFAULT_NOTIFICATION_EMAIL,
    emailBody: buildEnquiryStoreEmailBody(enquiry),
    replyEmailRecipient: customerEmail === 'not provided' ? '' : customerEmail,
    replyEmailSubject: `Enquiry Received - ${enquiry.subject || 'General enquiry'}`,
    replyEmailBody: buildEnquiryCustomerReplyBody(enquiry),
    createdAt: new Date().toISOString(),
  };
};

const submitFormSubmit = async (toEmail, payload) => {
  const body = {
    name: payload.name || 'Customer',
    email: payload.email || '',
    phone: payload.phone || '',
    subject: payload.subject || 'Suvarna IT Enterprises Notification',
    message: payload.message || '',
    _subject: payload._subject || payload.subject || 'Suvarna IT Enterprises Notification',
    _replyto: payload._replyto || payload.replyTo || '',
  };

  try {
    await fetch(`${FORMSUBMIT_ENDPOINT}/${encodeURIComponent(toEmail)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Browser CORS or FormSubmit rejection will be silent in this frontend-only demo.
  }
};

export async function sendNotification(type, payload) {
  if (type === 'order') {
    const notification = buildOrderNotificationPayload(payload);

    await submitFormSubmit(DEFAULT_NOTIFICATION_EMAIL, {
      name: notification.sender.name,
      email: notification.sender.email,
      phone: notification.sender.phone,
      subject: `Order Notification - ${notification.title}`,
      message: notification.emailBody,
      _subject: `Order Notification - ${notification.title}`,
    });

    if (notification.replyEmailRecipient) {
      await submitFormSubmit(notification.replyEmailRecipient, {
        name: COMPANY.name,
        email: DEFAULT_NOTIFICATION_EMAIL,
        phone: DEFAULT_NOTIFICATION_WHATSAPP,
        subject: notification.replyEmailSubject,
        message: notification.replyEmailBody,
        _subject: notification.replyEmailSubject,
        _replyto: DEFAULT_NOTIFICATION_EMAIL,
      });
    }

    return notification;
  }

  if (type === 'enquiry') {
    const notification = buildEnquiryNotificationPayload(payload);

    await submitFormSubmit(DEFAULT_NOTIFICATION_EMAIL, {
      name: notification.sender.name,
      email: notification.sender.email,
      phone: notification.sender.phone,
      subject: `Enquiry Notification - ${notification.title}`,
      message: notification.emailBody,
      _subject: `Enquiry Notification - ${notification.title}`,
    });

    if (notification.replyEmailRecipient) {
      await submitFormSubmit(notification.replyEmailRecipient, {
        name: COMPANY.name,
        email: DEFAULT_NOTIFICATION_EMAIL,
        phone: DEFAULT_NOTIFICATION_WHATSAPP,
        subject: notification.replyEmailSubject,
        message: notification.replyEmailBody,
        _subject: notification.replyEmailSubject,
        _replyto: DEFAULT_NOTIFICATION_EMAIL,
      });
    }

    return notification;
  }

  return null;
}

export function getNotificationLog() {
  return [];
}
