import { useState, useEffect, Children, cloneElement, isValidElement } from 'react';
import { Skeleton } from './Skeleton';

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden flex flex-col ${className}`}>
      <Skeleton className="aspect-square rounded-none" />
      <div className="px-3 pt-2 pb-3 flex flex-col gap-2">
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-4 w-16 mt-1" />
      </div>
    </div>
  );
}

export function SkeletonRow({ count = 4, className = '' }) {
  return (
    <div className={`flex gap-3 overflow-x-auto pb-1 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="w-[180px] shrink-0" />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 8, className = '' }) {
  return (
    <div className={`grid grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// Like FadeIn, but reveals each child on its own with a 50ms stagger — used
// for grids of product cards so they don't all pop in at once.
export function StaggeredFadeIn({ children, className = '', staggerMs = 50, ...rest }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={className} {...rest}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        const revealClass = `transition-all duration-300 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`;
        return cloneElement(child, {
          className: `${child.props.className || ''} ${revealClass}`.trim(),
          style: { ...(child.props.style || {}), transitionDelay: visible ? `${i * staggerMs}ms` : '0ms' },
        });
      })}
    </div>
  );
}

// Fades its children in on mount — used to soften the swap from skeleton to
// real content once loading finishes.
export function FadeIn({ children, className = '', ...rest }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${className}`} {...rest}>
      {children}
    </div>
  );
}
