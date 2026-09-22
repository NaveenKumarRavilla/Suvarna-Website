import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { handleImgError } from '../../utils/helpers';
import Button from '../common/Button';

const AUTOPLAY_MS = 10000;

export default function HeroSlider() {
  const { banners: heroSlides } = useAdmin();
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const videoRefs = useRef({});
  const sliderRef = useRef(null);
  const hasUserInteractionRef = useRef(false);
  const allowVideoPlaybackRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.removeItem('suvarna_hero_banner_index');
    } catch {
      // storage unavailable
    }
  }, []);

  const updateIndex = useCallback((nextIndex) => {
    if (!heroSlides.length) return;
    setIndex((nextIndex + heroSlides.length) % heroSlides.length);
  }, [heroSlides.length]);

  const goTo = useCallback(
    (i) => {
      if (!heroSlides.length) return;
      updateIndex(i);
    },
    [heroSlides.length, updateIndex]
  );

  const restartAutoplay = useCallback(() => {
    if (!heroSlides.length) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      updateIndex(index + 1);
    }, AUTOPLAY_MS);
  }, [heroSlides.length, index, updateIndex]);

  useEffect(() => {
    if (!heroSlides.length) {
      setIndex(0);
      return;
    }

    setIndex((prev) => (prev >= heroSlides.length ? 0 : prev));
    restartAutoplay();
    return () => clearInterval(timerRef.current);
  }, [heroSlides.length, restartAutoplay]);

  useEffect(() => {
    const handleInteraction = (event) => {
      const sliderNode = sliderRef.current;
      if (!sliderNode) return;

      const clickedInsideSlider = event.target && sliderNode.contains(event.target);
      if (!clickedInsideSlider) return;

      hasUserInteractionRef.current = true;
      allowVideoPlaybackRef.current = true;

      const activeVideo = videoRefs.current[heroSlides[index]?.id];
      if (!activeVideo) return;
      if (document.visibilityState === 'visible') {
        activeVideo.muted = false;
        activeVideo.play().catch(() => {
          activeVideo.muted = true;
          activeVideo.play().catch(() => {});
        });
      }
    };

    document.addEventListener('pointerdown', handleInteraction, { passive: true });
    document.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('keydown', handleInteraction, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [heroSlides, index]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([slideId, video]) => {
      if (!video) return;

      const isActive = String(slideId) === String(heroSlides[index]?.id ?? '');
      const shouldAutoPlay = document.visibilityState === 'visible' && allowVideoPlaybackRef.current && isActive;

      if (!isActive) {
        video.pause();
        video.currentTime = 0;
        return;
      }

      if (!shouldAutoPlay) {
        video.pause();
        video.muted = true;
        return;
      }

      video.muted = false;
      if (video.paused) {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    });
  }, [heroSlides, index]);

  useEffect(() => {
    const sliderNode = sliderRef.current;
    if (!sliderNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;

        const activeVideo = videoRefs.current[heroSlides[index]?.id];
        if (!activeVideo) return;

        const canPlay = entry.isIntersecting && document.visibilityState === 'visible' && allowVideoPlaybackRef.current;

        if (canPlay) {
          activeVideo.muted = false;
          activeVideo.play().catch(() => {
            activeVideo.muted = true;
            activeVideo.play().catch(() => {});
          });
        } else {
          activeVideo.pause();
          activeVideo.muted = true;
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(sliderNode);

    const handleVisibilityChange = () => {
      const activeVideo = videoRefs.current[heroSlides[index]?.id];
      if (!activeVideo) return;

      if (document.hidden || !allowVideoPlaybackRef.current) {
        activeVideo.pause();
        activeVideo.muted = true;
        return;
      }

      const isVisible = sliderRef.current && sliderRef.current.getBoundingClientRect().top < window.innerHeight && sliderRef.current.getBoundingClientRect().bottom > 0;
      if (isVisible) {
        activeVideo.muted = false;
        activeVideo.play().catch(() => {
          activeVideo.muted = true;
          activeVideo.play().catch(() => {});
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [heroSlides, index]);

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
      ref={sliderRef}
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
              className={`relative z-10 flex flex-col justify-center p-6 sm:p-10 ${
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
            <div className="absolute inset-0 flex items-center justify-center opacity-30 md:relative md:inset-auto md:p-8 md:opacity-100">
              {slide.mediaType === 'video' || slide.video ? (
                <div className="relative h-full w-full overflow-hidden md:h-[260px] md:rounded-xl md:shadow-2xl md:ring-1 md:ring-white/20 lg:h-[300px]">
                  <video
                    key={`${slide.id}-${index}`}
                    ref={(el) => {
                      if (el) videoRefs.current[slide.id] = el;
                    }}
                    src={slide.video || slide.image}
                    autoPlay={false}
                    loop
                    muted={true}
                    playsInline
                    controls={false}
                    preload="auto"
                    onCanPlay={(e) => {
                      if (
                        String(slide.id) === String(heroSlides[index]?.id ?? '') &&
                        document.visibilityState === 'visible' &&
                        allowVideoPlaybackRef.current
                      ) {
                        e.target.play().catch(() => {
                          e.target.muted = true;
                          e.target.play().catch(() => {});
                        });
                      }
                    }}
                  className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/30 via-transparent to-slate-900/20" />
                </div>
              ) : (
                <img
                  src={slide.image}
                  alt={slide.title}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  onError={handleImgError}
                  className="h-full w-full object-cover md:max-h-[300px] md:rounded-xl md:shadow-2xl md:ring-1 md:ring-white/20 lg:max-h-[340px]"
                />
              )}
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
