import { useState, useEffect } from 'react';

// Wraps a storefront page's root element so it fades/slides in on mount —
// gives route changes a subtle transition without a full animation library.
export default function PageTransition({ children, className = '' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`transition-all duration-200 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${className}`}>
      {children}
    </div>
  );
}
