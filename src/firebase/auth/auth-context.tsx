
'use client';

// This file is obsolete. All its logic has been merged into 
// src/context/inventory-context.tsx to create a single unified provider.
// This centralizes state management and resolves race conditions.
// The file can be safely deleted in a future step.

import { createContext } from 'react';
import type { Employee } from '@/lib/types';

interface AuthContextType {
  user: Employee | null;
  companyId: string | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
  registerCompany: (companyName: string, adminUsername: string, adminPass: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
