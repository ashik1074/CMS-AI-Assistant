import { createContext, useContext } from 'react';

export interface MascotRide {
  /** True while the mascot is away doing a trick; the mascot it left from stays hidden meanwhile. */
  riding: boolean;
  /** Start a random trick from the given mascot. Ignored while a ride is already under way. */
  launch: (from: HTMLElement) => void;
}

export const MascotRideContext = createContext<MascotRide>({ riding: false, launch: () => {} });

export const useMascotRide = () => useContext(MascotRideContext);
