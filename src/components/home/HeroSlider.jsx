import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { handleImgError } from '../../utils/helpers';
import Button from '../common/Button';

const AUTOPLAY_MS = 5000;

export default function HeroSlider() {
  const { banners: heroSlides } = useAdmin();
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const goTo = useCallback(
    (i) => setIndex((i + heroSlides.length) % heroSlides.length),
    []
  );

  const restartAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setIndex((prev) => (prev + 1) % heroSlides.length),
      AUTOPLAY_MS
    );
  }, []);

  useEffect(() => {
    restartAutoplay();
    return () => clearInterval(timerRef.current);
  }, [restartAutoplay]);

  const handlePrev = () => {
    goTo(index - 1);
    restartAutoplay();
  };
  const handleNext = () => {
    goTo(index + 1);
    restartAutoplay();
  };

  return (
    <section
      aria-label="Featured promotions"
      className="group/slider relative h-[320px] overflow-hidden rounded-2xl shadow-card sm:h-[380px] lg:h-[440px]"
    >
      {heroSlides.map((slide, i) => (
        <div
          key={slide.id}
          aria-hidden={i !== index}
          className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} transition-opacity duration-700 ${
            i === index ? 'z-10 opacity-100' : 'z-0 opacity-0'
          }`}
        >
          {/* decorative shapes */}
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" aria-hidden="true" />
          <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-accent/10" aria-hidden="true" />

          <div className="relative grid h-full md:grid-cols-2">
            <div
              className={`flex flex-col justify-center p-6 sm:p-10 ${
                i === index ? 'animate-slide-in' : ''
              }`}
            >
              <span className="mb-3 w-fit rounded-full bg-accent/20 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-accent">
                {slide.badge}
              </span>
              <h2 className="max-w-md text-2xl font-black leading-tight text-white sm:text-4xl lg:text-[42px]">
                {slide.title}
              </h2>
              <p className="mt-3 max-w-sm text-sm text-slate-300 sm:text-base">
                {slide.subtitle}
              </p>
              <div className="mt-6">
                <Button to={slide.link} variant="accent" size="lg" tabIndex={i === index ? 0 : -1}>
                  {slide.cta}
                </Button>
              </div>
            </div>
            <div className="hidden items-center justify-center p-8 md:flex">
              <img
                src={slide.image}
                alt={slide.title}
                loading={i === 0 ? 'eager' : 'lazy'}
                onError={handleImgError}
                className="max-h-[300px] w-full rounded-xl object-cover shadow-2xl ring-1 ring-white/20 lg:max-h-[340px]"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Arrows */}
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white opacity-0 backdrop-blur transition hover:bg-white/30 focus:opacity-100 group-hover/slider:opacity-100"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={handleNext}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white opacity-0 backdrop-blur transition hover:bg-white/30 focus:opacity-100 group-hover/slider:opacity-100"
      >
        <ChevronRight size={20} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {heroSlides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => {
              goTo(i);
              restartAutoplay();
            }}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i === index ? 'w-7 bg-accent' : 'w-2.5 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
