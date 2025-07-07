"use client";
import React from "react";
import { SmartSignature } from "./SmartSignature";

interface MultisigToolsProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function MultisigTools({ isLoading, setIsLoading }: MultisigToolsProps) {
  return (
    <div className="space-y-6">
      <SmartSignature isLoading={isLoading} setIsLoading={setIsLoading} />
    </div>
  );
} 