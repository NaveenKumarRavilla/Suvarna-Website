import { Link } from 'react-router-dom';

const policyMap = {
  shipping: {
    title: 'Shipping Policy',
    summary: 'We are committed to delivering your products safely, on time, and with full order transparency.',
    items: [
      {
        heading: 'Order Processing',
        text: 'Orders are processed within 24 to 48 business hours after confirmation and payment. We may require additional time for custom, bulk, or pre-order items.',
      },
      {
        heading: 'Delivery Timelines',
        text: 'Standard delivery generally takes 3 to 7 business days across India, depending on the product type, location, and courier partner. Priority or express shipping may be available for selected products.',
      },
      {
        heading: 'Shipping Charges',
        text: 'Shipping charges are calculated at checkout based on product weight, delivery location, and order value. Some selected items may qualify for free shipping promotions.',
      },
      {
        heading: 'Tracking & Updates',
        text: 'Once dispatched, customers receive shipment details and tracking information via email, WhatsApp, or phone. We are not liable for delays caused by courier partners, weather, natural events, or circumstances beyond our control.',
      },
    ],
  },
  returns: {
    title: 'Return Policy',
    summary: 'We aim to provide a smooth and fair return experience for damaged, incorrect, or defective products.',
    items: [
      {
        heading: 'Eligibility',
        text: 'Returns are accepted for products that are damaged in transit, defective on arrival, or materially different from the product description. Changes of mind purchases are reviewed on a case-by-case basis.',
      },
      {
        heading: 'Request Window',
        text: 'Customers must raise a return request within 7 days of delivery for eligible items. Please provide proof of issue, photos, and order details when submitting the request.',
      },
      {
        heading: 'Inspection & Approval',
        text: 'The product will be inspected before the refund, replacement, or exchange is approved. We reserve the right to reject requests in case of misuse, tampering, or missing original packaging.',
      },
      {
        heading: 'Refunds',
        text: 'Approved refunds are processed within 5 to 10 business days to the original mode of payment after confirmation. Shipping charges are non-refundable unless the issue is caused by us.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'We respect your privacy and handle your personal data in a secure and responsible manner.',
    items: [
      {
        heading: 'Information We Collect',
        text: 'We may collect your name, contact details, billing and shipping address, order history, product preferences, and inquiries submitted through our website, WhatsApp, or customer support channels.',
      },
      {
        heading: 'How We Use Your Data',
        text: 'Your information is used to process purchases, manage deliveries, fulfil service requests, improve customer support, and communicate important updates about your orders or account.',
      },
      {
        heading: 'Data Security',
        text: 'We implement reasonable administrative, technical, and organisational safeguards to protect your data from unauthorised access, misuse, leakage, or loss.',
      },
      {
        heading: 'Third-Party Sharing',
        text: 'We do not sell personal data. We may share limited information with trusted service providers such as logistics partners, payment gateways, and support systems for order fulfilment and operational support.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    summary: 'These terms govern your use of our website, products, and services and describe the responsibilities of both the customer and Suvarna IT Enterprises.',
    items: [
      {
        heading: 'Acceptance of Terms',
        text: 'By visiting our website, placing an order, or using our services, you agree to comply with these terms and conditions. We may revise them as needed, and continued use indicates acceptance of the updated version.',
      },
      {
        heading: 'Product Information',
        text: 'We strive to provide accurate product information, photographs, pricing, and availability. However, errors may occur, and we reserve the right to correct information and cancel orders whenever necessary.',
      },
      {
        heading: 'Orders & Payments',
        text: 'All orders are subject to product availability, verification, and successful payment confirmation. We reserve the right to refuse or cancel an order if there is suspicion of fraud, duplicate entry, or misuse.',
      },
      {
        heading: 'Limitation of Liability',
        text: 'Suvarna IT Enterprises is not liable for indirect, incidental, or consequential damages arising from the use of our products, services, or website, except where legally required.',
      },
    ],
  },
};

export default function PolicyPage({ slug = 'shipping' }) {
  const policy = policyMap[slug] || policyMap.shipping;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <Link to="/contact" className="inline-flex items-center text-sm font-medium text-secondary hover:text-primary">
          ← Back to Contact
        </Link>
      </div>

      <article className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
        <div className="mb-4 h-1 w-16 rounded-full bg-accent" aria-hidden="true" />
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-primary sm:text-3xl">
          {policy.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          {policy.summary}
        </p>

        <div className="mt-8 space-y-6">
          {policy.items.map(({ heading, text }) => (
            <section key={heading} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-base font-bold text-primary">{heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
