import HeroSlider from '../components/home/HeroSlider';
import PromoCards from '../components/home/PromoCards';
import FeaturedProducts from '../components/home/FeaturedProducts';
import ServiceFeatures from '../components/home/ServiceFeatures';
import CategoryGrid from '../components/home/CategoryGrid';
import ProductVideos from '../components/home/ProductVideos';
import ActiveOffers from '../components/home/ActiveOffers';

export default function Home() {
  return (
    <>
      <h1 className="sr-only">Suvarna IT Enterprises: Laptops, Desktops, Servers and IT Solutions</h1>
      <section className="mx-auto max-w-8xl px-4 pt-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroSlider />
          </div>
          <PromoCards />
        </div>
      </section>
      <FeaturedProducts />
      <ServiceFeatures />
      <CategoryGrid />
      <ActiveOffers />
      <ProductVideos />
    </>
  );
}
