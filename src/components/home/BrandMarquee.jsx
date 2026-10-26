const brandAssets = import.meta.glob('../../assets/brands/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
});

const brands = [
  ['hp', 'HP'],
  ['dell', 'Dell'],
  ['lenovo', 'Lenovo'],
  ['asus', 'ASUS'],
  ['acer', 'Acer'],
  ['intel', 'Intel'],
  ['amd', 'AMD'],
  ['microsoft', 'Microsoft'],
  ['canon', 'Canon'],
  ['epson', 'Epson'],
  ['brother', 'Brother'],
  ['lg', 'LG'],
  ['tp-link', 'TP-Link'],
  ['seagate', 'Seagate'],
  ['western-digital', 'Western Digital'],
  ['logitech', 'Logitech'],
  ['gigabyte', 'Gigabyte'],
  ['msi', 'MSI'],
  ['cooler-master', 'Cooler Master'],
  ['corsair', 'Corsair'],
  ['apc', 'APC'],
  ['samsung', 'Samsung'],
  ['nvidia', 'NVIDIA'],
].map(([slug, name]) => ({
  name,
  image: brandAssets[`../../assets/brands/${slug}.png`],
}));

function BrandItems({ decorative = false }) {
  return brands.map(({ name, image }) => (
    <li key={name} className="flex h-[88px] w-40 shrink-0 items-center justify-center sm:w-44">
      <img
        src={image}
        alt={decorative ? '' : name}
        aria-hidden={decorative}
        loading="lazy"
        className="h-[76px] w-full object-contain"
      />
    </li>
  ));
}

export default function BrandMarquee() {
  return (
    <section aria-labelledby="trusted-brands-title" className="mt-9">
      <h2 id="trusted-brands-title" className="mb-3 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        Trusted brands
      </h2>
      <div className="brand-marquee overflow-hidden">
        <div className="brand-marquee-track flex w-max">
          <ul className="flex shrink-0 items-center gap-3 pr-3 sm:gap-5 sm:pr-5" role="list">
            <BrandItems />
          </ul>
          <ul className="flex shrink-0 items-center gap-3 pr-3 sm:gap-5 sm:pr-5" role="list" aria-hidden="true">
            <BrandItems decorative />
          </ul>
        </div>
      </div>
    </section>
  );
}
