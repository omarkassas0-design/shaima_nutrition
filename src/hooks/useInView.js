import { useEffect, useRef, useState } from 'react';

/**
 * Returns [ref, inView]. Attach ref to the element that should be watched.
 * Once the element has been visible it stays true (the observer disconnects),
 * so images are loaded once and never reloaded while scrolling.
 */
export default function useInView(options) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px', ...(options || {}) }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  return [ref, inView];
}