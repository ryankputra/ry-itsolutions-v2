"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type BottomBarId = "bottom-nav" | "spotify-player" | "product-detail" | string;

export interface BottomBarRegistration {
  id: BottomBarId;
  height: number; // pixels, including safe-area
  priority: number; // higher = closer to bottom (bottom-nav = 100, spotify = 50, product-detail = 30)
  isActive: boolean;
}

interface BottomBarContextValue {
  registerBar: (registration: BottomBarRegistration) => () => void;
  getBarOffset: (id: BottomBarId) => number; // offset from bottom for this bar
  getTotalHeight: () => number;
}

const BottomBarContext = createContext<BottomBarContextValue | null>(null);

export function BottomBarProvider({ children }: { children: ReactNode }) {
  const [registrations, setRegistrations] = useState<Map<BottomBarId, BottomBarRegistration>>(new Map());

  // Update CSS custom properties on root element
  const updateCSSVariables = useCallback(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    let currentBottom = 0;

    // Sort by priority descending (highest priority = closest to bottom)
    const sorted = Array.from(registrations.values())
      .filter(r => r.isActive)
      .sort((a, b) => b.priority - a.priority);

    sorted.forEach((reg, index) => {
      const varName = `--bottom-bar-${reg.id.replace(/[^a-z0-9]/gi, '-')}-offset`;
      root.style.setProperty(varName, `${currentBottom}px`);
      currentBottom += reg.height;
    });

    // Total height for page padding
    root.style.setProperty("--bottom-bars-total-height", `${currentBottom}px`);

    // Individual heights
    sorted.forEach(reg => {
      const heightVar = `--bottom-bar-${reg.id.replace(/[^a-z0-9]/gi, '-')}-height`;
      root.style.setProperty(heightVar, `${reg.height}px`);
    });
  }, [registrations]);

  useEffect(() => {
    updateCSSVariables();
  }, [updateCSSVariables]);

  const registerBar = useCallback((registration: BottomBarRegistration) => {
    setRegistrations(prev => {
      const next = new Map(prev);
      next.set(registration.id, registration);
      return next;
    });

    // Return unregister function
    return () => {
      setRegistrations(prev => {
        const next = new Map(prev);
        next.delete(registration.id);
        return next;
      });
    };
  }, []);

  const getBarOffset = useCallback((id: BottomBarId) => {
    const reg = registrations.get(id);
    if (!reg || !reg.isActive) return 0;

    const sorted = Array.from(registrations.values())
      .filter(r => r.isActive && r.priority > reg.priority)
      .sort((a, b) => b.priority - a.priority);

    return sorted.reduce((sum, r) => sum + r.height, 0);
  }, [registrations]);

  const getTotalHeight = useCallback(() => {
    return Array.from(registrations.values())
      .filter(r => r.isActive)
      .reduce((sum, r) => sum + r.height, 0);
  }, [registrations]);

  return (
    <BottomBarContext.Provider value={{ registerBar, getBarOffset, getTotalHeight }}>
      {children}
    </BottomBarContext.Provider>
  );
}

export function useBottomBar() {
  const context = useContext(BottomBarContext);
  if (!context) {
    throw new Error("useBottomBar must be used within a BottomBarProvider");
  }
  return context;
}

// Hook for individual bar components
export function useBottomBarRegistration(
  id: BottomBarId,
  height: number,
  priority: number,
  isActive: boolean = true
) {
  const { registerBar } = useBottomBar();

  useEffect(() => {
    if (!isActive) return;
    const unregister = registerBar({ id, height, priority, isActive });
    return unregister;
  }, [id, height, priority, isActive, registerBar]);

  // Return CSS variable name for this bar's offset
  return `--bottom-bar-${id.replace(/[^a-z0-9]/gi, '-')}-offset`;
}