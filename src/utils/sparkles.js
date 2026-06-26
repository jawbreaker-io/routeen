// jawbreaker.io signature flourish: a burst of candy sprinkles (raspberry, gold,
// green, blue dots) on positive actions. Honours prefers-reduced-motion.
const SPRINKLES = ['#EA2467', '#FFB205', '#7AB42C', '#1F8FD0'];

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function spawnSparks(x, y) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;

  const count = 14;
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span');
    spark.className = 'jb-spark';
    spark.style.setProperty('--spark-c', SPRINKLES[i % SPRINKLES.length]);
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;

    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const distance = 60 + Math.random() * 90;
    spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    spark.style.setProperty('--sc', (0.7 + Math.random() * 0.9).toFixed(2));
    spark.style.animationDelay = `${Math.random() * 70}ms`;

    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 1050);
  }
}

// Burst sprinkles from the centre of the element that triggered an event.
export function sparkFromEvent(event) {
  if (!event) return;
  const target = event.currentTarget || event.target;
  if (!target || !target.getBoundingClientRect) return;
  const rect = target.getBoundingClientRect();
  spawnSparks(rect.left + rect.width / 2, rect.top + rect.height / 2);
}
