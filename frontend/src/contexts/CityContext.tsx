"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CityState {
  city: string;
  lat: number;
  lon: number;
  codeInsee: string;
  codePostal: string;
}

const DEFAULT: CityState = {
  city:       process.env.NEXT_PUBLIC_PILOT_CITY || "Nantes",
  lat:        parseFloat(process.env.NEXT_PUBLIC_PILOT_LAT  || "47.2184"),
  lon:        parseFloat(process.env.NEXT_PUBLIC_PILOT_LON  || "-1.5536"),
  codeInsee:  "44109",
  codePostal: "44000",
};

interface CityContextType extends CityState {
  setCity: (c: CityState) => void;
}

const CityContext = createContext<CityContextType>({
  ...DEFAULT,
  setCity: () => {},
});

export function CityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CityState>(DEFAULT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("immo-city");
      if (saved) setState(JSON.parse(saved));
    } catch {}
  }, []);

  const setCity = (newCity: CityState) => {
    setState(newCity);
    try { localStorage.setItem("immo-city", JSON.stringify(newCity)); } catch {}
  };

  return (
    <CityContext.Provider value={{ ...state, setCity }}>
      {children}
    </CityContext.Provider>
  );
}

export const useCity = () => useContext(CityContext);
