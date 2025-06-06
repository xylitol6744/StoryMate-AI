import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { motion } from "framer-motion";

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 마우스 흔들림 효과 (배경에만 적용)
  useEffect(() => {
    let frameId: number | null = null;
    const moveRange = 8;

    const handleMouseMove = (e: MouseEvent) => {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        const x = -(e.clientX / window.innerWidth - 0.5) * moveRange;
        const y = -(e.clientY / window.innerHeight - 0.5) * moveRange;
        setOffset({ x, y });
        frameId = null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, []);

  const btnBase =
    "w-full max-w-xl px-6 py-2 rounded-2xl font-normal text-lg border border-white/30 transition focus:outline-none select-none " +
    "bg-white/10 text-white shadow-md hover:shadow-[0_0_24px_0_rgba(255,255,255,0.7)]";

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(16px)", scale: 0.98 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)", scale: 1.02 }}
      transition={{
        opacity: { duration: 0.6, ease: "easeInOut" },
        filter: { duration: 0.6, ease: "easeInOut" },
        scale: { duration: 0.6, ease: "easeInOut" }
      }}
      className="relative h-screen w-full text-white"
    >
      {/* ==== 배경만 흔들림 ==== */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundImage: "url('/bg.jpg')",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
          filter: "brightness(0.9)",
          transform: `scale(1.04) translate(${offset.x}px, ${offset.y}px)`,
          transition: "transform 0.1s ease-out",
          willChange: "transform",
          zIndex: -10,
        }}
      />
      {/* =================== */}

      {/* === 컨텐츠는 절대 안 움직임! === */}
      <div className="flex flex-col items-center justify-center h-screen w-full">
        <div className="w-full max-w-xl flex flex-col items-center">
          <div className="w-full flex flex-col items-center select-none">
            <h1
              className="select-none text-4xl md:text-6xl font-extrabold mb-7 relative inline-block"
              style={{
                fontFamily: "'DNFBitBitv2', 'Pretendard', sans-serif",
                letterSpacing: "2px",
                textShadow: "0 2px 16px rgba(0,0,0,0.24)",
              }}
            >
              <span>StoryMate AI</span>
              {user && (
                <span
                  className="absolute text-yellow-400 md:text-sm text-[11px] font-bold animate-pulse-scale pointer-events-none select-none"
                  style={{
                    right: "-40px",
                    top: "46px",
                    transform: "rotate(-22deg)",
                    textShadow: "2px 2px 0 #000",
                    fontFamily: "'DNFBitBitv2', 'Pretendard', sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  Press F11
                </span>
              )}
            </h1>
            <p className="select-none mb-10 text-lg md:text-xl text-gray-100 font-medium drop-shadow text-center">
              꿈을 현실처럼 이야기로, AI와 함께 이어쓰는 나만의 드림 저널!
            </p>
          </div>

          {!user && (
            <div className="w-full flex justify-center">
              <button
                onClick={() => navigate("/login")}
                className={
                  "w-full max-w-xl px-6 py-2 rounded-2xl font-thin text-lg border-none transition focus:outline-none select-none " +
                  "bg-white/10 text-white shadow-md hover:shadow-[0_0_24px_0_rgba(255,255,255,0.7)] animated-gradient-A"
                }
                type="button"
              >
                <span className="font-normal">로그인</span>
              </button>
            </div>
          )}

          {user && (
            <div className="space-y-3 w-full max-w-xs">
              <button onClick={() => navigate("/chat")} className={btnBase + " active:text-gray-300"}>
                <span className="font-normal">꿈 이어꾸기</span>
              </button>
              <button onClick={() => navigate("/history")} className={btnBase + " active:text-gray-300"}>
                <span className="font-normal">히스토리</span>
              </button>
              <button onClick={() => navigate("/mypage")} className={btnBase + " active:text-gray-300"}>
                <span className="font-normal">마이페이지</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {/* ============================== */}
    </motion.div>
  );
}

export default Home;
