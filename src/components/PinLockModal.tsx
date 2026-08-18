import React, { useState, useEffect, useRef } from "react";
import { Lock, KeyRound, Check, X, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

interface PinLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetName?: string;
  currentPin: string; // default "0000"
  onChangePin?: (newPin: string) => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetName = "Locked Playlist / Adult Category",
  currentPin,
  onChangePin,
}) => {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [oldPinInput, setOldPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [pinStep, setPinStep] = useState<"old" | "new">("old");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setErrorMsg("");
      setIsChangingPin(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle number input
  const handleDigit = (digit: string) => {
    setErrorMsg("");
    if (isChangingPin) {
      if (pinStep === "old") {
        if (oldPinInput.length < 4) {
          const updated = oldPinInput + digit;
          setOldPinInput(updated);
          if (updated.length === 4) {
            if (updated === currentPin) {
              setPinStep("new");
              setOldPinInput("");
            } else {
              setErrorMsg("Incorrect current PIN! (Default is 0000)");
              setOldPinInput("");
            }
          }
        }
      } else {
        if (newPinInput.length < 4) {
          const updated = newPinInput + digit;
          setNewPinInput(updated);
          if (updated.length === 4) {
            onChangePin?.(updated);
            setIsChangingPin(false);
            setNewPinInput("");
            setPinStep("old");
            setErrorMsg("PIN updated successfully!");
          }
        }
      }
      return;
    }

    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        if (newPin === currentPin) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg("Incorrect PIN! Default password is 0000");
          setTimeout(() => setPin(""), 600);
        }
      }
    }
  };

  const handleBackspace = () => {
    setErrorMsg("");
    if (isChangingPin) {
      if (pinStep === "old") {
        setOldPinInput((prev) => prev.slice(0, -1));
      } else {
        setNewPinInput((prev) => prev.slice(0, -1));
      }
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setErrorMsg("");
    if (isChangingPin) {
      setOldPinInput("");
      setNewPinInput("");
    } else {
      setPin("");
    }
  };

  // Keyboard & Remote Control Key Down Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pin, isChangingPin, oldPinInput, newPinInput, pinStep, currentPin]);

  if (!isOpen) return null;

  const currentDisplayPin = isChangingPin
    ? pinStep === "old"
      ? oldPinInput
      : newPinInput
    : pin;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col items-center text-center">
        {/* Glow Effect */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
          <Lock className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-black text-white uppercase tracking-wide">
          {isChangingPin ? "Change Playlist PIN" : "Playlist PIN Protection"}
        </h3>
        <p className="text-xs text-slate-400 mt-1 mb-4 max-w-[260px]">
          {isChangingPin
            ? pinStep === "old"
              ? "Enter current PIN password (Default is 0000)"
              : "Enter new 4-digit PIN password"
            : `Enter 4-digit PIN password to unlock "${targetName}"`}
        </p>

        {/* Default PIN Hint Badge */}
        <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Default Password: <strong className="font-mono text-white">0000</strong></span>
        </div>

        {/* Hidden input for mobile keyboard */}
        <input
          ref={inputRef}
          type="tel"
          pattern="[0-9]*"
          maxLength={4}
          value={currentDisplayPin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            if (val.length <= 4) {
              const lastDigit = val.slice(-1);
              if (lastDigit && val.length > currentDisplayPin.length) {
                handleDigit(lastDigit);
              } else if (val.length < currentDisplayPin.length) {
                handleBackspace();
              }
            }
          }}
          className="sr-only"
        />

        {/* 4-Digit Display Dots */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex items-center justify-center gap-3 mb-5 cursor-pointer"
        >
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = idx < currentDisplayPin.length;
            return (
              <div
                key={`pin-dot-${idx}`}
                className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-mono font-black transition-all ${
                  isFilled
                    ? "border-amber-400 bg-amber-400/10 text-amber-300 scale-105 shadow-md shadow-amber-400/20"
                    : "border-slate-800 bg-slate-950/60 text-slate-600"
                }`}
              >
                {isFilled ? "•" : ""}
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div
            className={`text-xs font-bold px-3 py-1.5 rounded-xl mb-4 w-full flex items-center justify-center gap-1.5 ${
              errorMsg.includes("updated")
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/30 text-rose-400 animate-bounce"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Keypad 0-9 */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={`keypad-${num}`}
              onClick={() => handleDigit(num)}
              className="h-12 rounded-2xl bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-white font-mono font-black text-lg transition-all active:scale-95 shadow-md border border-slate-700/60"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-12 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs uppercase transition-all border border-slate-800"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigit("0")}
            className="h-12 rounded-2xl bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-white font-mono font-black text-lg transition-all active:scale-95 shadow-md border border-slate-700/60"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-12 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs uppercase transition-all border border-slate-800"
          >
            ⌫
          </button>
        </div>

        {/* Change PIN Link */}
        <div className="flex items-center justify-between w-full text-xs pt-2 border-t border-slate-800">
          <button
            onClick={() => {
              setIsChangingPin(!isChangingPin);
              setPinStep("old");
              setOldPinInput("");
              setNewPinInput("");
              setErrorMsg("");
            }}
            className="text-amber-400 hover:underline font-bold flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{isChangingPin ? "Cancel Change" : "Change PIN"}</span>
          </button>

          <span className="text-slate-500 text-[10px]">TV Remote Numbers Supported</span>
        </div>
      </div>
    </div>
  );
};
