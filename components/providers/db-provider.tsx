"use client";

import { createContext, useContext, type ReactNode } from "react";
import { db } from "@/lib/db";
import type Dexie from "dexie";

type DbType = typeof db;

const DbContext = createContext<DbType | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): DbType {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error("useDb must be used within DbProvider");
  return ctx;
}
