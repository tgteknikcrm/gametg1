/**
 * Küçük renk yardımcıları — arayüzdeki izometrik küp önizlemesi için.
 * Bir hex rengin üç yüzünü (üst / sol / sağ) üretiriz; sahnedeki gerçek
 * aydınlatmayı taklit eder, ekstra varlık gerektirmez.
 */

function clamp(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** `amount` > 0 açar, < 0 karartır. Aralık kabaca -1 … 1. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const mix = amount > 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  const channel = (value: number) => clamp(value + (mix - value) * ratio);
  return `#${[channel(r), channel(g), channel(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** İzometrik küpün üç yüzü: üst aydınlık, sağ orta, sol gölgede. */
export function cubeFaces(hex: string) {
  return {
    top: shade(hex, 0.18),
    right: shade(hex, -0.1),
    left: shade(hex, -0.32),
  };
}
