'use client';
import { type ReactNode, createContext, useRef } from 'react';

import type { settingsSchema } from '@runtipi/shared';
import type { z } from 'zod';
import { createClientSettingsStore } from './client-settings-store';

export type ClientSettingsStoreApi = ReturnType<typeof createClientSettingsStore>;

export const ClientSettingsStoreContext = createContext<ClientSettingsStoreApi | undefined>(undefined);

export interface ClientSettingsStoreProviderProps {
  children: ReactNode;
  initialSettings: z.infer<typeof settingsSchema>;
}

export const ClientSettingsStoreProvider = ({ children, initialSettings }: ClientSettingsStoreProviderProps) => {
  const storeRef = useRef<ClientSettingsStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createClientSettingsStore(initialSettings);
  }

  return <ClientSettingsStoreContext.Provider value={storeRef.current}>{children}</ClientSettingsStoreContext.Provider>;
};
