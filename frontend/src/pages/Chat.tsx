import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  deleteField,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import TitlePrompt from "../components/TitlePrompt";
import type { FC } from "react";

type Message = {
  role: "user" | "ai";
  content: string;
};

const Chat: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [summaryCheckpoint, setSummaryCheckpoint] = useState<number>(-1);
  const [aiTyping, setAiTyping] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [dotIndex, setDotIndex] = useState(2);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  const [overlayOpacity, setOverlayOpacity] = useState(0.44);
  const [hasEntered, setHasEntered] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const [storyDone, setStoryDone] = useState(false);

  useEffect(() => { setHasEntered(true); }, []);

  // 배경 이미지 처리
  useEffect(() => {
    const originalBackground = document.body.style.background;
    const originalBackgroundColor = document.body.style.backgroundColor;
    document.body.style.background = "url('/bg.jpg') center/cover no-repeat fixed";
    document.body.style.backgroundColor = "#000";
    return () => {
      document.body.style.background = originalBackground;
      document.body.style.backgroundColor = originalBackgroundColor;
    };
  }, []);

  function toFirestoreMessages(msgs: Message[]) {
    return msgs.map((msg) => `${msg.role}:${msg.content}`);
  }
  function fromFirestoreMessages(msgs: string[]): Message[] {
    return msgs.map((raw) => {
      const idx = raw.indexOf(":");
      if (idx === -1) return { role: "ai", content: raw };
      const role = raw.slice(0, idx) as "user" | "ai";
      const content = raw.slice(idx + 1);
      return { role, content };
    });
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      const cid = searchParams.get("cid");
      if (currentUser && cid) {
        setConversationId(cid);
        const convoRef = doc(db, "users", currentUser.uid, "conversations", cid);
        const snap = await getDoc(convoRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data?.messages) setMessages(fromFirestoreMessages(data.messages));
          if (data?.summary) setSummary(data.summary);
          if (data?.summaryCheckpoint !== undefined) setSummaryCheckpoint(data.summaryCheckpoint);
          if (data?.isCompleted) setIsFinished(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, aiTyping, aiThinking]);

  useEffect(() => {
    if (isFinishing) {
      const handlePopState = () => {
        window.history.pushState(null, "", window.location.href);
      };
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", handlePopState);

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [isFinishing]);

  useEffect(() => {
    if (cooldown) {
      const t = setTimeout(() => setCooldown(false), 3000);
      return () => clearTimeout(t);
    }
  }, [cooldown]);

  useEffect(() => {
    if (!aiThinking) return;
    setDotIndex(2);
    const timer = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % 3);
    }, 650);
    return () => clearInterval(timer);
  }, [aiThinking]);

  const getGPTResponse = async (userMessage: string): Promise<string> => {
    try {
      if (!user) return "❌ 인증되지 않은 사용자입니다.";
      const token = await user.getIdToken();
      const contextMessages = toFirestoreMessages(messages.slice(summaryCheckpoint + 1));
      const contextBlock = contextMessages.join("\n");

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ summary, context: contextBlock, userMessage }),
      });

      if (!res.ok) throw new Error("GPT 요청 실패");

      const data = await res.json();
      return typeof data.reply === "string" ? data.reply : "응답 없음";
    } catch (error) {
      console.error("프록시 서버 오류:", error);
      return "❌ 서버 연결 실패";
    }
  };

  const summarizeOldMessages = async (convoId: string, oldMessages: Message[]) => {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const rawMessages = toFirestoreMessages(oldMessages);

      const res = await fetch(`${API_BASE_URL}/api/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: rawMessages }),
      });

      if (!res.ok) throw new Error("요약 API 실패");
      const data = await res.json();
      const newSummary = `${summary}\n${data.summary}`;

      const docRef = doc(db, "users", user.uid, "conversations", convoId);
      await updateDoc(docRef, {
        summary: newSummary,
        summaryCheckpoint: messages.length - 1,
      });

      setSummary(newSummary);
      setSummaryCheckpoint(messages.length - 1);
    } catch (err) {
      console.error("요약 실패:", err);
    }
  };

  const addAITypingMessage = (text: string) => {
    setAiTyping(true);
    let curr = "";
    let idx = 0;
    const typeLetter = () => {
      curr += text[idx];
      setMessages((prev) => {
        if (
          prev.length &&
          prev[prev.length - 1].role === "ai" &&
          prev[prev.length - 1].content.length < text.length
        ) {
          return [...prev.slice(0, -1), { role: "ai", content: curr }];
        }
        return [...prev, { role: "ai", content: curr }];
      });
      idx++;
      if (idx < text.length) {
        setTimeout(typeLetter, 80);
      } else {
        setAiTyping(false);
        setCooldown(true);
      }
    };
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);
    setTimeout(typeLetter, 100);
  };

  const handleSend = async () => {
    if (!input.trim() || loading || isFinished || aiTyping || cooldown || !user) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setAiThinking(true);

    try {
      let convoId = conversationId;
      if (!convoId) {
        const convoRef = await addDoc(collection(db, "users", user.uid, "conversations"), {
          title: "새로운 대화",
          createdAt: serverTimestamp(),
          isCompleted: false,
          messages: [],
          summary: "",
          summaryCheckpoint: -1,
        });
        setConversationId(convoRef.id);
        convoId = convoRef.id;
      }

      if (messages.length - summaryCheckpoint >= 8) {
        const toSummarize = messages.slice(summaryCheckpoint + 1);
        await summarizeOldMessages(convoId, toSummarize);
      }

      const gptReply = await getGPTResponse(userMsg);
      setAiThinking(false);
      addAITypingMessage(gptReply);

      const docRef = doc(db, "users", user.uid, "conversations", convoId);
      await updateDoc(docRef, {
        messages: arrayUnion(`user:${userMsg}`, `ai:${gptReply}`),
      });
    } catch (err) {
      setAiThinking(false);
      setAiTyping(false);
      setCooldown(false);
      console.error("저장 또는 응답 오류:", err);
      setMessages((prev) => [...prev, { role: "ai", content: "❌ GPT 응답 실패" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishConversation = () => {
    if (!user || !conversationId || isFinished || isFinishing) return;
    setShowTitlePrompt(true);
  };

  // 제목 입력 → 애니메이션 → 스토리 저장
  const handleTitleConfirm = async (storyTitle: string) => {
    setShowTitlePrompt(false);
    if (!storyTitle || storyTitle.trim() === "") {
      alert("제목이 입력되지 않아 취소되었습니다.");
      return;
    }
    if (storyTitle.length > 11) {
      alert("제목은 11자 이내로 입력해주세요.");
      return;
    }

    setIsFinishing(true);
    setAnimationDone(false);
    setStoryDone(false);

    // 4초 애니메이션
    let start = Date.now();
    const duration = 4444;
    const animate = () => {
      const elapsed = Date.now() - start;
      const percent = Math.min(elapsed / duration, 1);
      setOverlayOpacity(0.44 * (1 - percent));
      if (percent < 1) {
        requestAnimationFrame(animate);
      } else {
        setAnimationDone(true);
      }
    };
    animate();

    // 스토리 API 호출 및 저장
    try {
      const ref = doc(db, "users", user!.uid, "conversations", conversationId!);
      const plain = messages
        .filter((msg) => msg.role === "user" || msg.role === "ai")
        .map((msg) => msg.content)
        .join("\n");

      const token = await user!.getIdToken();
      const storyRes = await fetch(`${API_BASE_URL}/api/story`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: plain }),
      });

      const storyData = await storyRes.json();
      const story = storyData.reply || "요약 실패";

      await updateDoc(ref, {
        isCompleted: true,
        story,
        title: storyTitle,
        summary: deleteField(),
        summaryCheckpoint: deleteField(),
      });
      setStoryDone(true);
    } catch (error) {
      console.error("이야기 정리 실패:", error);
      alert("정리 중 오류가 발생했습니다.");
      setStoryDone(true);
    }
  };

  // 두 애니메이션 모두 완료 시 히스토리로 이동
  useEffect(() => {
    if (isFinishing && animationDone && storyDone) {
      setIsFinished(true);
      navigate(`/history?bid=${conversationId}`);
      setIsFinishing(false);
      setOverlayOpacity(0.44);
    }
  }, [animationDone, storyDone, isFinishing, conversationId, navigate]);

  const handleTitleCancel = () => setShowTitlePrompt(false);

  const bubbleVariants = {
    hidden: { opacity: 0, scale: 0.98, y: 16 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25 } },
  };

  const renderMessage = (msg: Message, idx: number) => {
    const isUser = msg.role === "user";
    return (
      <motion.div
        key={idx}
        className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-3`}
        initial="hidden"
        animate="visible"
        variants={bubbleVariants}
      >
        <div
          className={`
            max-w-[70%] px-4 py-3 text-white text-base font-normal
            rounded-2xl select-none text-left
            bg-white/10
            ${isUser ? "self-end" : "self-start"}
          `}
          style={{
            border: "none",
            boxShadow: "none",
            transition: "none",
            wordBreak: "keep-all",
            overflowWrap: "break-word",
            backdropFilter: "none",
            whiteSpace: "pre-line"
          }}
        >
          {msg.content}
        </div>
      </motion.div>
    );
  };

  const renderThinkingBubble = () => {
    const dots = [".", "..", "..."];
    return (
      <motion.div
        className="flex w-full justify-start mb-2"
        initial="hidden"
        animate="visible"
        variants={bubbleVariants}
      >
        <div
          className={`
            max-w-[70%] px-5 py-3 text-white text-base font-normal
            rounded-2xl select-none
            bg-white/10
          `}
          style={{
            border: "none",
            background: "rgba(255,255,255,0.1)",
            boxShadow: "None",
            transition: "background 0.2s",
            wordBreak: "keep-all",
            backdropFilter: "none",
            fontStyle: "italic",
            minHeight: "38px",
          }}
        >
          {dots[dotIndex]}
        </div>
      </motion.div>
    );
  };

  // TitlePrompt 모달만 렌더링
  if (showTitlePrompt && !isFinishing) {
    return (
      <>
        <div className="fixed inset-0 z-0" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
        <TitlePrompt
          open={true}
          onConfirm={handleTitleConfirm}
          onCancel={handleTitleCancel}
          maxLength={11}
        />
      </>
    );
  }

  // isFinishing이면 오버레이만
  if (isFinishing) {
    return (
      <>
        <div className="fixed inset-0 z-10" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
      </>
    );
  }

  // 평소 화면
  return (
    <>
      {/* 오버레이 */}
      {!hasEntered ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-0"
          style={{ background: `rgba(0,0,0,${overlayOpacity})`, pointerEvents: "none" }}
        />
      ) : (
        <div
          className="fixed inset-0 z-0"
          style={{ background: `rgba(0,0,0,${overlayOpacity})`, pointerEvents: "none" }}
        />
      )}

      <motion.div
        initial={{ opacity: 0, filter: "blur(16px)", scale: 0.98 }}
        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
        exit={{ opacity: 0, filter: "blur(8px)", scale: 1.02 }}
        transition={{
          opacity: { duration: 0.6, ease: "easeInOut" },
          filter: { duration: 0.6, ease: "easeInOut" },
          scale: { duration: 0.6, ease: "easeInOut" },
        }}
        className="flex flex-col h-screen w-full items-center px-2 relative overflow-hidden"
      >
        {/* 채팅 메시지 영역 */}
        <div
          className="
            flex flex-col w-full max-w-2xl mx-auto flex-1 py-6 px-2
            overflow-y-auto
            rounded-2xl justify-end
          "
          style={{
            background: "none",
            minHeight: 0,
            maskImage: "linear-gradient(to bottom, transparent, black 14px)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 144px)",
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            flex: 1,
          }}
        >
          {messages.length === 0 ? (
            <div style={{ flexGrow: 1 }} className="flex items-end">
              <p className="text-white/60 text-sm italic text-center mb-4 select-none w-full">
                꿈 이야기로 대화를 시작해보세요.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => renderMessage(msg, idx))}
              {aiThinking && renderThinkingBubble()}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef}></div>
        </div>

        {/* 하단 입력 바 */}
        <div className="w-full max-w-2xl mx-auto flex pb-7 pt-3 gap-3 items-end flex-shrink-0">
          <div className="flex flex-col gap-2"
            style={{
              minWidth: 160,
              maxWidth: 200,
              width: 0,
            }}
          >
            {conversationId && !isFinished && !isFinishing && (
              <button
                onClick={handleFinishConversation}
                className={`
                  px-4 py-2 rounded-2xl font-normal text-base
                  transition select-none text-white shadow-md
                  bg-white/10 hover-animated-gradient-A
                `}
                style={{ minWidth: 673, minHeight: 44, border: "none", outline: "none" }}
              >
                <span className="font-normal">꿈에서 깨어나기</span>
              </button>
            )}
            {!isFinishing && (
              <button
                onClick={() => navigate("/")}
                className={`
                  px-4 py-2 rounded-2xl font-normal text-base border-none
                  transition select-none text-white shadow-md
                  bg-white/10 w-[68px] active:text-gray-300
                `}
                style={{ minWidth: 0, minHeight: 44 }}
              >
                <span className="font-normal"> ← </span>
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="메시지를 입력하세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={44}
            className="
              flex-1 min-w-0 px-5 py-3 rounded-2xl text-white bg-white/10 select-none
              shadow focus:outline-none focus:ring-0 border-none
              text-sm font-normal transition
              focus:border-none focus:shadow-none
              placeholder-white/60
            "
            style={{
              height: "44px",
              lineHeight: "44px",
              outline: "none",
              boxShadow: "none",
              border: "none",
              minWidth: 0,
              marginLeft: -98,
              marginRight: 0,
              userSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none",
              msUserSelect: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            disabled={loading || aiTyping || aiThinking || cooldown || isFinished || isFinishing}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            autoComplete="off"
            onCopy={e => e.preventDefault()}
            onPaste={e => e.preventDefault()}
            onCut={e => e.preventDefault()}
            onContextMenu={e => e.preventDefault()}
            draggable={false}
          />
          <button
            onClick={handleSend}
            disabled={loading || aiTyping || aiThinking || cooldown || isFinished || isFinishing}
            className={`ml-2 px-40 py-3 rounded-2xl text-white font-normal select-none text-base w-[68px] active:text-gray-300 ${
              loading || aiTyping || aiThinking || cooldown || isFinished || isFinishing
                ? "bg-white/10"
                : "bg-white/10"
            }`}
            style={{
              height: "44px",
              minWidth: 56,
              minHeight: 44,
              marginLeft: -5,
              padding: 0,
              lineHeight: "44px",
            }}
          >
            ↑
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default Chat;
