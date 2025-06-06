import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TitlePromptProps {
  open: boolean;
  onConfirm: (title: string) => void;
  onCancel: () => void;
  maxLength?: number;
}

export default function TitlePrompt({
  open,
  onConfirm,
  onCancel,
  maxLength = 24,
}: TitlePromptProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-[10000]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              position: "relative",
            }}
            className="rounded-2xl shadow-sm px-8 py-7 flex flex-col w-[370px] max-w-full"
          >
            {/* x 버튼 */}
            <button
              onClick={onCancel}
              aria-label="닫기"
              tabIndex={0}
              className="absolute top-3 right-4 select-none text-white active:text-gray-300"
              style={{
                background: "transparent",
                border: "none",
                boxShadow: "none",
                padding: 0,
                margin: 0,
                fontSize: "1.4rem",
                lineHeight: 1,
                cursor: "pointer",
                userSelect: "none",
              }}
              onMouseDown={e => e.preventDefault()}
              onDragStart={e => e.preventDefault()}
              onContextMenu={e => e.preventDefault()}
            >
              <span
                style={{
                  userSelect: "none",
                  fontWeight: "thin",
                  pointerEvents: "none",
                }}
                unselectable="on"
              >
                x
              </span>
            </button>

            <div className="text-2xl font-normal mb-7 text-white select-none">
              이야기 제목 입력
            </div>

            {/* input */}
            <div className="flex justify-center">
              <input
                ref={inputRef}
                type="text"
                className="px-4 py-2 rounded-2xl border-none outline-none bg-white/5 text-white text-base font-normal mb-3"
                style={{
                  width: 244,
                  height: 44,
                  WebkitUserSelect: "none",
                  userSelect: "none",
                  border: "none",
                  outline: "none",
                }}
                maxLength={maxLength}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="최대 11자"
                onKeyDown={e => {
                  if (e.key === "Enter") onConfirm(value.trim());
                  if (e.key === "Escape") onCancel();
                }}
                onCopy={e => e.preventDefault()}
                onPaste={e => e.preventDefault()}
                onCut={e => e.preventDefault()}
                onContextMenu={e => e.preventDefault()}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>

            {/* placeholder 드래그 방지 */}
            <style>{`
              input::placeholder {
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                pointer-events: none;
              }
            `}</style>

            {/* 버튼 */}
            <div className="flex justify-center gap-3 mt-2">
              <button
                onClick={() => onConfirm(value.trim())}
                disabled={!value.trim()}
                onMouseDown={e => e.preventDefault()}
                onDragStart={e => e.preventDefault()}
                onContextMenu={e => e.preventDefault()}
                onMouseOver={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 0 24px 0 rgba(255,255,255,0.7)";
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
                className={`
                  px-4 py-2 rounded-2xl font-normal text-base
                  transition select-none text-white
                  bg-white/10 hover-animated-gradient-A
                `}
                style={{
                  width: 244,
                  height: 44,
                  border: "none",
                  outline: "none",
                }}
              >
                <span className="font-normal select-none pointer-events-none">
                  꿈에서 깨어나기
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
