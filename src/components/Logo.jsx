export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
        <span className="absolute inset-0 top-0 h-1/2 bg-faso-red" />
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-faso-green" />
        <span className="relative text-sm font-black text-faso-gold">★</span>
      </span>
      <span className="text-lg font-black tracking-tight text-white">
        FASO<span className="text-faso-gold">-</span>ZIK
      </span>
    </span>
  );
}
