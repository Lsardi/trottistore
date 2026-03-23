"use client";

import { motion, useScroll, useTransform, useInView, useMotionValueEvent } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── FADE IN ON SCROLL ───────────────────────────────────────
export function FadeIn({
  children,
  className,
  delay = 0,
  direction = "up",
  duration = 0.6,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  duration?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const directionOffset = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { y: 0, x: 40 },
    right: { y: 0, x: -40 },
    none: { y: 0, x: 0 },
  };

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        y: directionOffset[direction].y,
        x: directionOffset[direction].x,
      }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── STAGGER CHILDREN ────────────────────────────────────────
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        visible: { transition: { staggerChildren: staggerDelay } },
        hidden: {},
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── PARALLAX SECTION ────────────────────────────────────────
export function Parallax({
  children,
  className,
  speed = 0.3,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * -100, speed * 100]);

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

// ─── SCALE ON SCROLL ─────────────────────────────────────────
export function ScaleOnScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0.5]);

  return (
    <motion.div ref={ref} style={{ scale, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

// ─── ANIMATED COUNTER ────────────────────────────────────────
export function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  className,
  duration = 2,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  const motionValue = useTransform(
    useScroll({ target: ref, offset: ["start end", "center center"] }).scrollYProgress,
    [0, 1],
    [0, value]
  );

  useMotionValueEvent(motionValue, "change", (latest) => {
    if (isInView) {
      setDisplayValue(Math.round(latest));
    }
  });

  return (
    <span ref={ref} className={className}>
      {prefix}
      {isInView ? displayValue : 0}
      {suffix}
    </span>
  );
}

// ─── TEXT REVEAL ─────────────────────────────────────────────
export function TextReveal({
  children,
  className,
  delay = 0,
}: {
  children: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <span ref={ref} className={cn("inline-block overflow-hidden", className)}>
      <motion.span
        className="inline-block"
        initial={{ y: "110%" }}
        animate={isInView ? { y: 0 } : {}}
        transition={{
          duration: 0.7,
          delay,
          ease: [0.33, 1, 0.68, 1],
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}

// ─── HORIZONTAL SCROLL (CSS scroll-snap, GPU-friendly) ──────
export function HorizontalScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <div
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 px-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── REVEAL IMAGE ────────────────────────────────────────────
export function RevealImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div
        initial={{ scaleY: 1 }}
        animate={isInView ? { scaleY: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
        className="absolute inset-0 bg-gray-900 origin-top z-10"
      />
      <motion.img
        src={src}
        alt={alt}
        initial={{ scale: 1.3 }}
        animate={isInView ? { scale: 1 } : {}}
        transition={{ duration: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

// ─── MAGNETIC BUTTON ─────────────────────────────────────────
export function MagneticButton({
  children,
  className,
  onClick,
  href,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
  }

  function handleMouseLeave() {
    const el = ref.current;
    if (el) el.style.transform = "translate(0, 0)";
  }

  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={href}
      onClick={onClick}
      className={className}
    >
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="transition-transform duration-200"
      >
        {children}
      </div>
    </Tag>
  );
}
