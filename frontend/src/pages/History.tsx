// @ts-ignore
import html2pdf from "html2pdf.js";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection, getDocs, query, doc, deleteDoc, updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";


interface Conversation {
  id: string;
  title?: string;
  createdAt: any;
  isCompleted: boolean;
  story?: string;
}

function History() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const bid = searchParams.get("bid");
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [user, setUser] = useState<User | null>(null);

  const [currentBookId, setCurrentBookId] = useState<string | null>(null);

  useEffect(() => {
    if (!bid) return;
    if (conversations.length === 0) return;
    const exists = conversations.some((c) => c.id === bid);
    if (exists) setCurrentBookId(bid);
  }, [bid, conversations]);

  const prevIdxRef = useRef<number>(0);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  // 애니메이션 관련 상태
  const [showStoryOnBook, setShowStoryOnBook] = useState(false);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [fadeOut, setFadeOut] = useState(false);

  // 흔들림 상태
  const [offset, setOffset] = useState({ x: 0, y: 0 });
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

  const navigate = useNavigate();

  useEffect(() => {
    setShowStoryOnBook(false);
    setDisplayedText("");
    setCurrentSentenceIdx(0);
    setTypedLength(0);
    setFadeOut(false);
  }, [currentBookId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchConversations(currentUser.uid);
      }
    });
    return () => unsub();
  }, []);

  const fetchConversations = async (uid: string) => {
    const convoRef = collection(db, "users", uid, "conversations");
    const q = query(convoRef);
    const snap = await getDocs(q);
    const data = snap.docs.map((doc) => {
      const raw = doc.data();
      const { summary, ...safe } = raw;
      return {
        id: doc.id,
        ...(safe as Omit<Conversation, "id">),
      };
    });
    setConversations(data);

    if (!currentBookId && data.length) {
      const sorted = [...data].sort((a, b) => {
        const ad = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
        const bd = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
        return bd - ad;
      });
      const firstUnfinished = sorted.find(item => !item.isCompleted);
      setCurrentBookId(firstUnfinished ? firstUnfinished.id : sorted[0].id);
    }
  };

  const filtered = [
    ...[...conversations].filter(c => !c.isCompleted).sort((a, b) => {
      const ad = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
      const bd = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
      return bd - ad;
    }),
    ...[...conversations].filter(c => c.isCompleted).sort((a, b) => {
      const ad = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
      const bd = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
      return bd - ad;
    })
  ].filter((convo) => {
    return searchKeyword
      ? (convo.title && convo.title.toLowerCase().includes(searchKeyword.toLowerCase()))
      : true;
  });

  useEffect(() => {
    if (!filtered.length) {
      setCurrentBookId(null);
      prevIdxRef.current = 0;
      return;
    }
    const idx = filtered.findIndex(x => x.id === currentBookId);
    if (idx === -1) {
      setCurrentBookId(filtered[0].id);
      prevIdxRef.current = 0;
      setSlideDir(null);
    } else {
      prevIdxRef.current = idx;
    }
  }, [filtered]);

  const currentIdx = currentBookId
    ? filtered.findIndex(item => item.id === currentBookId)
    : 0;
  const disablePrev = currentIdx <= 0;
  const disableNext = currentIdx >= filtered.length - 1;
  const currentItem = filtered[currentIdx] ?? null;

  // 문장 나누기
  const sentences = currentItem?.story?.split(/(?<=\.)\s+/g) ?? [];

  const CHAR_INTERVAL = 122;
  const PAUSE_AFTER_TYPING = 1440;
  const FADE_DURATION = 700;

  const [isPaused, setIsPaused] = useState(false);
  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    if (!showStoryOnBook || !sentences.length) return;
    if (isPaused) return;

    const full = sentences[currentSentenceIdx] || "";
    let i = typedLength;
    setDisplayedText(full.slice(0, i));
    setFadeOut(false);

    const typeInterval = setInterval(() => {
      setDisplayedText(full.slice(0, i + 1));
      setTypedLength(i + 1);
      i++;
      if (i >= full.length) clearInterval(typeInterval);
    }, CHAR_INTERVAL);

    const typingDuration = (full.length - i) * CHAR_INTERVAL;
    const showTime = typingDuration + PAUSE_AFTER_TYPING;

    const fadeTimer = setTimeout(() => setFadeOut(true), showTime);
    const nextTimer = setTimeout(() => {
      setTypedLength(0);
      if (currentSentenceIdx < sentences.length - 1) {
        setCurrentSentenceIdx((idx) => idx + 1);
      } else {
        setShowStoryOnBook(false);
      }
    }, showTime + FADE_DURATION);

    return () => {
      clearInterval(typeInterval);
      clearTimeout(fadeTimer);
      clearTimeout(nextTimer);
    };
  }, [showStoryOnBook, currentSentenceIdx, isPaused, typedLength]);

  const movePrev = () => {
    if (currentIdx > 0) {
      setSlideDir("left");
      setCurrentBookId(filtered[currentIdx - 1].id);
    }
  };
  const moveNext = () => {
    if (currentIdx < filtered.length - 1) {
      setSlideDir("right");
      setCurrentBookId(filtered[currentIdx + 1].id);
    }
  };

  useEffect(() => {
    const idx = filtered.findIndex(item => item.id === currentBookId);
    prevIdxRef.current = idx;
  }, [currentBookId, filtered]);

  const handleContinue = (id: string) => navigate(`/chat?cid=${id}`);

  // ------- 커스텀 삭제 모달용 상태 및 함수 추가 -------
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 삭제 버튼 클릭 시 → 삭제할 id만 저장
  const askDelete = (id: string) => setDeleteTargetId(id);

  // 모달 '확인' 클릭 시 실제 삭제
  const handleConfirmDelete = async () => {
    if (!user || !deleteTargetId) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "conversations", deleteTargetId));
      setConversations((prev) => prev.filter((c) => c.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) {
      console.error("삭제 실패:", err);
      alert("삭제 중 오류가 발생했습니다.");
      setDeleteTargetId(null);
    }
  };
  // 모달 '취소' 클릭 시 닫기
  const handleCancelDelete = () => setDeleteTargetId(null);

  const handleDownloadPDF = (title: string, story: string) => {
    const content = `
      <div style="padding: 24px; font-family: sans-serif; background-color: white; color: black;">
        <h2 style="text-align: center; margin-bottom: 20px;">${title}</h2>
        <hr style="margin-bottom: 12px;" />
        <p style="white-space: pre-line; line-height: 1.6;">${story}</p>
      </div>
    `;
    html2pdf()
      .set({
        margin: 0.5,
        filename: `${title}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      })
      .from(content)
      .save();
  };
  const startEditing = (id: string, currentTitle: string = "") => {
    setEditingId(id);
    setEditedTitle(currentTitle);
  };
  const confirmEdit = async (id: string) => {
    if (!user || editedTitle.trim() === "") {
      setEditingId(null);
      return;
    }
    try {
      const ref = doc(db, "users", user.uid, "conversations", id);
      await updateDoc(ref, { title: editedTitle });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editedTitle } : c))
      );
      setEditingId(null);
    } catch (err) {
      console.error("제목 수정 오류:", err);
      alert("제목 수정에 실패했습니다.");
    }
  };

  const btnBase =
    "px-4 py-2 rounded-2xl font-normal text-base " +
    "bg-white/10 border border-white/30 text-white " +
    "shadow-md hover:shadow-[0_0_24px_0_rgba(255,255,255,0.7)] " +
    "transition focus:outline-none focus:ring-0 focus:border-none select-none";

  const getBookImage = (item: Conversation) => {
    if (!item.isCompleted) return "/book_open.png";
    return "/book.png";
  };

  const variants = {
    enter: (direction: "left" | "right" | null) => {
      if (!direction) return { x: 0, opacity: 0, position: "absolute" as const };
      return {
        x: direction === "left" ? -400 : 400,
        opacity: 0,
        position: "absolute" as const,
      };
    },
    center: { x: 0, opacity: 1, position: "relative" as const },
    exit: (direction: "left" | "right" | null) => {
      if (!direction) return { x: 0, opacity: 0, position: "absolute" as const };
      return {
        x: direction === "left" ? 400 : -400,
        opacity: 0,
        position: "absolute" as const,
      };
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(16px)", scale: 0.98 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)", scale: 1.02 }}
      transition={{
        opacity: { duration: 0.6, ease: "easeInOut" },
        filter: { duration: 0.6, ease: "easeInOut" },
        scale: { duration: 0.6, ease: "easeInOut" },
      }}
      className="relative min-h-screen w-full"
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
      {/* ======================= */}

      <div className="p-6 max-w-3xl mx-auto space-y-6 select-none">
        {/* 상단 바 */}
        <div className="flex items-center gap-2 mb-4 w-full" style={{ marginLeft: "68px" }}>
          <button
            onClick={() => navigate("/")}
            className={
              "inline-flex items-center justify-center px-6 py-2.5 rounded-2xl font-normal text-base " +
              "bg-white/10 text-white border border-white/30 shadow-md " +
              "hover:shadow-[0_0_24px_0_rgba(255,255,255,0.7)] " +
              "transition active:text-gray-300"
            }
            style={{ textDecoration: "none" }}
            tabIndex={0}
            type="button"
          >
            ←
          </button>
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="제목으로 검색"
            className="border border-black/20 px-4 py-2 rounded-2xl bg-white bg-opacity-80 text-black text-base font-normal select-text shadow box-border transition-none focus:outline-none focus:ring-0 focus:border-black/20 w-[444px]"
            tabIndex={0}
            style={{
              minWidth: 0,
              boxSizing: "border-box",
              transition: "none"
            }}
            spellCheck={false}
            onPaste={e => e.preventDefault()}
          />
        </div>
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400">검색 결과가 없습니다.</p>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-[calc(100vh-120px)] relative">
            {/* 화살표(왼쪽) */}
            {!disablePrev && (
              <button
                onClick={movePrev}
                className="absolute left-2 z-20 text-5xl px-3 py-1
                  bg-transparent border-none text-white
                  hover:bg-transparent hover:text-white
                  active:text-gray-300 transition
                  rounded-full top-1/2 -translate-y-1/2
                  select-none shadow-none
                  focus:outline-none focus:ring-0 focus:border-none"
                style={{
                  boxShadow: "none",
                }}
                tabIndex={0}
                aria-label="이전 이야기"
              >
                {"<"}
              </button>
            )}

            {/* 책(이미지+내용) 슬라이드 애니메이션 */}
            <div className="relative flex flex-col items-center justify-center min-h-[300px]">
              <AnimatePresence initial={false} custom={slideDir}>
                {currentItem && (
                  <motion.div
                    key={currentItem.id}
                    className="flex flex-col items-center justify-center w-full"
                    custom={slideDir}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 430, damping: 38 },
                      opacity: { duration: 0.23 }
                    }}
                  >
                    <div className="relative w-full max-w-[444px] mx-auto group">
                      {currentItem.isCompleted && (
                        <div
                          className="
                            absolute
                            left-1/2 top-[58%]
                            -translate-x-1/2 -translate-y-1/2
                            pointer-events-none
                            opacity-0
                            group-hover:opacity-100
                            transition-opacity duration-300
                          "
                          style={{
                            width: "300px",
                            height: "340px",
                            zIndex: -1,
                            borderRadius: "12%",
                            filter: "blur(24px)",
                            background: "rgba(255,255,255,0.7)",
                          }}
                        />
                      )}
                      {/* 책 이미지 */}
                      <img
                        src={getBookImage(currentItem)}
                        alt="book"
                        className={`
                          relative z-10
                          w-full max-w-[444px] h-auto mx-auto object-contain select-none pointer-events-auto
                          ${currentItem.isCompleted ? "cursor-pointer" : "cursor-default"}
                        `}
                        draggable={false}
                        style={{
                          marginTop: currentItem.isCompleted ? "78px" : "24px",
                          borderRadius: 24,
                        }}
                        onClick={() => {
                          if (!showStoryOnBook) {
                            setShowStoryOnBook(true);
                            setCurrentSentenceIdx(0);
                            setFadeOut(false);
                            setIsPaused(false);
                          } else {
                            setIsPaused(v => !v);
                          }
                        }}
                      />
                      {/* story 한 문장씩 애니메이션 (showStoryOnBook) */}
                      {showStoryOnBook && currentItem.isCompleted && currentItem.story && (
                        <div
                          className="absolute top-[16%] left-[17%] w-[66.5%] h-[74%] flex items-center justify-center px-5 pt-4 pb-5 z-20"
                          style={{ pointerEvents: "none", overflow: "hidden" }}
                        >
                          <div
                            className={`
                              whitespace-pre-wrap break-keep wrap-normal
                              text-white text-[1.08rem] leading-relaxed text-center drop-shadow-lg
                              transition-opacity duration-700 ease-in-out
                              ${fadeOut ? "opacity-0" : "opacity-100"}
                            `}
                            style={{
                              textShadow: "0 2px 12px rgba(0,0,0,0.55)",
                              fontWeight: 400,
                              userSelect: "text",
                              maxHeight: "81%",
                              overflowY: "hidden",
                              lineHeight: "1.85",
                              fontFamily: "inherit",
                              letterSpacing: "0.01em",
                              whiteSpace: "pre-line",
                            }}
                          >
                            {displayedText}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 제목 + 날짜/시간 + 버튼 */}
                    <div className="flex flex-col items-center justify-end w-full mt-[-28px]">
                      {currentItem.isCompleted && (
                        <div className="flex flex-col items-center w-full">
                          <div className="flex items-center justify-center w-full mb-1 relative">
                            {editingId === currentItem.id ? (
                              <div className="relative w-[320px] flex flex-col items-center z-20">
                                <input
                                  value={editedTitle}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 11) setEditedTitle(e.target.value);
                                  }}
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && confirmEdit(currentItem.id)
                                  }
                                  onBlur={() => confirmEdit(currentItem.id)}
                                  className="text-xl font-normal text-white text-center outline-none border-none w-full z-20"
                                  maxLength={11}
                                  tabIndex={0}
                                  autoFocus
                                  spellCheck={false}
                                  onPaste={e => e.preventDefault()}
                                  style={{
                                    background: "transparent",
                                    boxShadow: "none",
                                    border: "none",
                                    outline: "none",
                                    padding: 0,
                                    margin: 0,
                                    height: "48px",
                                    lineHeight: "48px",
                                    fontWeight: 400,
                                    textShadow: "0 2px 16px rgba(0,0,0,0.34), 0 0 8px #195 10%",
                                  }}
                                />
                                <span
                                  className="absolute bottom-[-4px] right-32 text-xs text-gray-300 z-20"
                                  style={{ fontWeight: 400 }}
                                >
                                  {editedTitle.length} / 11자
                                </span>
                              </div>
                            ) : (
                              <h3
                                className="font-normal text-xl text-white break-all drop-shadow text-center w-full cursor-pointer z-20"
                                style={{
                                  textShadow: "0 2px 16px rgba(0,0,0,0.34), 0 0 8px #195 10%",
                                  userSelect: "text",
                                  height: "48px",
                                  lineHeight: "48px",
                                  fontWeight: 400,
                                }}
                                onClick={() =>
                                  currentItem.title && startEditing(currentItem.id, currentItem.title)
                                }
                              >
                                {currentItem.title}
                              </h3>
                            )}
                          </div>
                          {/* 날짜/시간 + 버튼들 가로정렬 */}
                          <div className="flex items-center justify-center w-full gap-2">
                            <p className="text-xs text-white mt-0 drop-shadow text-center">
                              {currentItem.createdAt?.toDate().toLocaleString?.() ?? "시각 정보 없음"}
                            </p>
                            {currentItem.story && (
                              <button
                                onClick={() => handleDownloadPDF(currentItem.title!, currentItem.story!)}
                                className={btnBase + "transition active:text-gray-300"}
                                tabIndex={0}
                                type="button"
                              >
                                받기
                              </button>
                            )}
                            <button
                              onClick={() => askDelete(currentItem.id)}
                              className={btnBase + "transition active:text-red-500"}
                              tabIndex={0}
                              type="button"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 미완성 대화는 제목 수정 자체 미노출 + 버튼 가로 정렬 */}
                      {!currentItem.isCompleted && (
                        <div 
                          className="flex items-center justify-center w-full gap-2"
                          style={{ position: "relative" }}
                        >
                          <p className="text-xs text-white mt-0 drop-shadow text-center">
                            {currentItem.createdAt?.toDate().toLocaleString?.() ?? "시각 정보 없음"}
                          </p>
                          <button
                            style={{ position: "relative", zIndex: 30, }}
                            onClick={() => handleContinue(currentItem.id)}
                            className={btnBase + " hover-animated-gradient-T transition"}
                            tabIndex={0}
                            type="button"
                          >
                            꿈 더 꾸기
                          </button>
                          <button
                            style={{ position: "relative", zIndex: 40, }}
                            onClick={() => askDelete(currentItem.id)}
                            className={btnBase + "transition active:text-red-500"}
                            tabIndex={0}
                            type="button"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 화살표(오른쪽) */}
            {!disableNext && (
              <button
                onClick={moveNext}
                className="absolute right-2 z-20 text-5xl px-3 py-1
                  bg-transparent border-none text-white
                  hover:bg-transparent hover:text-white
                  active:text-gray-300 transition
                  rounded-full top-1/2 -translate-y-1/2
                  select-none shadow-none
                  focus:outline-none focus:ring-0 focus:border-none"
                style={{
                  boxShadow: "none",
                }}
                tabIndex={0}
                aria-label="다음 이야기"
              >
                {">"}
              </button>
            )}

            {/* ----------- 삭제 확인 모달 ------------- */}
            <AnimatePresence>
              {deleteTargetId && (
                <DeleteConfirmModal
                  onConfirm={handleConfirmDelete}
                  onCancel={handleCancelDelete}
                />
              )}
            </AnimatePresence>
            {/* ------------------------------------- */}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default History;

// ---------- 커스텀 삭제 모달 컴포넌트 (같은 파일에 추가!) ----------
function DeleteConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      key="delete-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-white/5 rounded-2xl shadow-xl px-2 py-7 flex flex-col items-center w-[280px]"
        style={{ boxShadow: "0 8px 40px 0 rgba(0,0,0,0.28)" }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeInOut" }}
      >
        <div className="text-white text-lg font-normal mb-3">
          정말 삭제하시겠습니까?
        </div>
        <div className="flex gap-3 mt-1 w-full justify-center">
          <button
            className="bg-white/5 active:text-red-500 hover:shadow-[0_0_24px_0_rgba(255,255,255,0.7)] font-normal rounded-xl px-6 py-2 transition"
            onClick={onConfirm}
            style={{
              outline: "none",
            }}
            autoFocus
          >
            네
          </button>
          <button
            className="bg-white/5 active:text-gray-300 hover:shadow-[0_0_24px_0_rgba(255,255,255,0.7)] text-white font-normal rounded-xl px-6 py-2 transition"
            onClick={onCancel}
            style={{
              outline: "none",
            }}
          >
            아니요
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

