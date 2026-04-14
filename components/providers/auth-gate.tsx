"use client";

import { type ReactNode } from "react";
import { useCrypto } from "./crypto-provider";
import { LockScreen } from "@/components/lock-screen";
import { Spinner } from "@minnjii/dx-kit/ui/spinner";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isSetup, isUnlocked } = useCrypto();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!isSetup || !isUnlocked) {
    return <LockScreen />;
  }

  return <>{children}</>;
}
