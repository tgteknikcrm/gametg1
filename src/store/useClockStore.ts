import { create } from "zustand";

/**
 * Saniyede bir ilerleyen ortak saat.
 *
 * Geri sayımlar için her bileşenin kendi `setInterval`'ını kurması yerine tek
 * bir kaynak var; yalnızca zaman gösteren bileşenler abone olur, sahne ve
 * paneller etkilenmez.
 */
interface ClockState {
  now: number;
  tick: () => void;
}

export const useClockStore = create<ClockState>((set) => ({
  now: Date.now(),
  tick: () => set({ now: Date.now() }),
}));
