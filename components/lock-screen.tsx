"use client";

import { useState } from "react";
import { useCrypto } from "@/components/providers/crypto-provider";
import { Button } from "@minnjii/dx-kit/ui/button";
import { Input } from "@minnjii/dx-kit/ui/input";
import { Label } from "@minnjii/dx-kit/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@minnjii/dx-kit/ui/card";
import { Lock, Eye, EyeOff } from "lucide-react";

export function LockScreen() {
  const { isSetup, setup, unlock } = useCrypto();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    if (password.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await setup(password);
    } catch {
      setError("설정 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    setLoading(true);
    setError("");
    try {
      const ok = await unlock(password);
      if (!ok) setError("비밀번호가 틀렸습니다");
    } catch {
      setError("잠금 해제 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSetup) {
      handleUnlock();
    } else {
      handleSetup();
    }
  };

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl tracking-tight">
              {isSetup ? "잠금 해제" : "비밀번호 설정"}
            </CardTitle>
            <CardDescription>
              {isSetup
                ? "비밀번호를 입력하세요"
                : "노트를 보호할 비밀번호를 설정하세요"}
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {!isSetup && (
              <div className="grid gap-2">
                <Label htmlFor="confirm">비밀번호 확인</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="off"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "처리 중..."
                : isSetup
                  ? "잠금 해제"
                  : "설정 완료"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
