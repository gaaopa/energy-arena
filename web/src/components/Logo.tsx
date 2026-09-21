export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <div className="select-none leading-none">
      <span
        className={`font-display font-bold uppercase tracking-[0.08em] text-ink ${
          lg ? 'text-5xl' : 'text-[26px]'
        }`}
      >
        Ener
        <span className="text-brand drop-shadow-[0_0_16px_rgb(249_115_22/0.5)]">
          g
        </span>
        y
      </span>
      <span
        className={`block font-semibold uppercase text-muted ${
          lg
            ? 'mt-1 text-xs tracking-[0.62em]'
            : 'mt-0.5 text-[9px] tracking-[0.55em]'
        }`}
      >
        Arena
      </span>
    </div>
  );
}
