"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";

export type Slot = "nav" | "player" | "product-action" | "other";

export interface Registration {
  slot: Slot;
  priority: number;
  height: number;
  isVisible: boolean;
}

interface SlotState {
  registration: Registration | null;
  cssVar: string;
}

interface BottomBarStackContextValue {
  registerSlot: (registration: Registration) => () => void;
  useBottomOffset: (slot: Slot) => string;
  totalReservedHeight: number;
}

const SlotPriority: Record<Slot, number> = {
  nav: 100,
  "product-action": 80,
  player: 60,
  other: 40,
};

const SlotOrder: Slot[] = ["nav", "product-action", "player", "other"];

const BottomBarStackContext = createContext<BottomBarStackContextValue | null>(null);

export function BottomBarStackProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Map<Slot, SlotState>>(new Map());

  const registerSlot = useCallback((registration: Registration) => {
    const { slot, priority, height, isVisible } = registration;
    const cssVar = `--bottom-bar-${slot}-offset`;

    setSlots((prev) => {
      const next = new Map(prev);
      next.set(slot, { registration: { ...registration }, cssVar });
      return next;
    });

    return () => {
      setSlots((prev) => {
        const next = new Map(prev);
        next.delete(slot);
        return next;
      });
    };
  }, []);

  const visibleSlots = useMemo(() => {
    return SlotOrder.filter((slot) => {
      const state = slots.get(slot);
      return state?.registration?.isVisible ?? false;
    });
  }, [slots]);

  const totalReservedHeight = useMemo(() => {
    let total = 0;
    visibleSlots.forEach((slot, index) => {
      const state = slots.get(slot);
      if (state?.registration) {
        total += state.registration.height;
        if (index > 0) total += 4; // 4px gap between slots
      }
    });
    return total;
  }, [slots, visibleSlots]);

  const useBottomOffset = useCallback((slot: Slot) => {
    const slotIndex = SlotOrder.indexOf(slot);
    const visibleBefore = visibleSlots.filter(
      (s) => SlotOrder.indexOf(s) < slotIndex
    );

    let offset = 0;
    visibleBefore.forEach((s, index) => {
      const state = slots.get(s);
      if (state?.registration) {
        offset += state.registration.height;
        if (index > 0) offset += 4;
      }
    });

    return `${offset}px`;
  }, [slots, visibleSlots]);

  const value = useMemo(
    () => ({
      registerSlot,
      useBottomOffset,
      totalReservedHeight,
    }),
    [registerSlot, useBottomOffset, totalReservedHeight]
  );

  useEffect(() => {
    // Write total height to CSS custom property for global access
    document.documentElement.style.setProperty(
      "--bottom-bars-total-height",
      `${totalReservedHeight}px`
    );

    // Write individual slot offsets
    SlotOrder.forEach((slot) => {
      const state = slots.get(slot);
      if (state?.registration) {
        const slotIndex = SlotOrder.indexOf(slot);
        const visibleBefore = visibleSlots.filter(
          (s) => SlotOrder.indexOf(s) < slotIndex
        );

        let offset = 0;
        visibleBefore.forEach((s, index) => {
          const beforeState = slots.get(s);
          if (beforeState?.registration) {
            offset += beforeState.registration.height;
            if (index > 0) offset += 4;
          }
        });

        document.documentElement.style.setProperty(
          `--bottom-bar-${slot}-offset`,
          `${offset}px`
        );
        document.documentElement.style.setProperty(
          `--bottom-bar-${slot}-height`,
          `${state.registration.height}px`
        );
      }
    });
  }, [slots, visibleSlots, totalReservedHeight]);

  return (
    <BottomBarStackContext.Provider value={value}>
      {children}
    </BottomBarStackContext.Provider>
  );
}

export function useBottomBarStack() {
  const context = useContext(BottomBarStackContext);
  if (!context) {
    throw new Error("useBottomBarStack must be used within BottomBarStackProvider");
  }
  return context;
}

export function useBottomOffset(slot: Slot): string {
  const { useBottomOffset: useBottomOffsetFn } = useBottomBarStack();
  return useBottomOffsetFn(slot);
}

export function useSlotRegistration(
  slot: Slot,
  height: number,
  isVisible: boolean = true
) {
  const { registerSlot } = useBottomBarStack();
  const priority = SlotPriority[slot];

  useEffect(() => {
    if (!isVisible) return;
    const unregister = registerSlot({ slot, priority, height, isVisible });
    return unregister;
  }, [slot, height, isVisible, registerSlot]);
}