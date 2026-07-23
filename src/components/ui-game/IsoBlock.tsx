import { cubeFaces } from "@/lib/color";
import { cn } from "@/lib/utils";

/**
 * Saf CSS izometrik küp — kart ve panellerdeki bina önizlemesi.
 *
 * Üç clip-path yüzü, sahnedeki gerçek küple aynı renk ve aynı aydınlatma
 * mantığını kullanır. Görsel varlık, canvas veya ekstra istek gerektirmez.
 */
export function IsoBlock({
  color,
  size = 44,
  tall = false,
  className,
}: {
  color: string;
  size?: number;
  /** Yüksek binalar için gövdeyi uzatır. */
  tall?: boolean;
  className?: string;
}) {
  const faces = cubeFaces(color);
  const bodyHeight = tall ? 42 : 30;
  const topY = tall ? 8 : 20;

  return (
    <span
      aria-hidden
      className={cn("relative block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* üst yüz */}
      <span
        className="absolute inset-x-0"
        style={{
          top: `${topY}%`,
          height: "40%",
          background: faces.top,
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        }}
      />
      {/* sol yüz */}
      <span
        className="absolute left-0"
        style={{
          top: `${topY + 20}%`,
          width: "50%",
          height: `${bodyHeight}%`,
          background: faces.left,
          clipPath: "polygon(0% 0%, 100% 50%, 100% 100%, 0% 50%)",
        }}
      />
      {/* sağ yüz */}
      <span
        className="absolute right-0"
        style={{
          top: `${topY + 20}%`,
          width: "50%",
          height: `${bodyHeight}%`,
          background: faces.right,
          clipPath: "polygon(100% 0%, 100% 50%, 0% 100%, 0% 50%)",
        }}
      />
    </span>
  );
}
