import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { motion } from "framer-motion";

function MyPage() {
  const navigate = useNavigate();
  const ADMIN_UID = "4IQNhyFFHTWQJnSVR4zXVYCqpo03";
  const [user, setUser] = useState<User | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [tokenUsed, setTokenUsed] = useState<number>(0);
  const tokenLimit = 144000;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate("/");
        return;
      }
      setUser(currentUser);

      const convoRef = collection(db, "users", currentUser.uid, "conversations");
      const allSnap = await getDocs(convoRef);
      setTotalCount(allSnap.size);

      const completedSnap = await getDocs(query(convoRef, where("isCompleted", "==", true)));
      setCompletedCount(completedSnap.size);

      const today = new Date();
      const year = today.getFullYear();
      const month = `${today.getMonth() + 1}`.padStart(2, "0");
      const day = `${today.getDate()}`;
      const monthKey = `${year}-${month}`;

      const tokenDocRef = doc(db, "users", currentUser.uid, "tokenUsage", monthKey);
      const tokenDoc = await getDoc(tokenDocRef);
      if (tokenDoc.exists()) {
        const data = tokenDoc.data().countByDay || {};
        setTokenUsed(data[day] || 0);
      } else {
        setTokenUsed(0);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const logout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  const goToHome = () => {
    navigate("/");
  };

  const tokenPercent = Math.round((tokenUsed / tokenLimit) * 100);

  const cardGap = "gap-y-4";
  const buttonGroupGap = "gap-2";
  const buttonHeight = "h-12";
  const buttonTextSize = "text-base";
  const buttonPadding = "px-5 py-4";
  const buttonTopMargin = "mt-1";

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
      className="flex items-center justify-center min-h-screen bg-transparent select-none"
    >
      <div className={`w-full max-w-xl mx-auto px-6 py-8 flex flex-col ${cardGap}`}>
        {user && !loading ? (
          <>
            {/* 프로필 카드 */}
            <div className="flex justify-between items-center p-4 rounded-xl bg-white/10 shadow text-white text-sm font-normal select-none">
              {/* 왼쪽: 이미지 + 텍스트 */}
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full overflow-hidden bg-white/20">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="profile" className="w-full h-full object-cover select-none" draggable={false} />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-xl text-white font-normal select-none">
                      {user.displayName ? user.displayName[0] : "?"}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start ml-2 select-none">
                  <span className="font-normal text-white text-sm select-none">{user.displayName || "사용자"}</span>
                  <span className="text-white text-sm font-normal select-none">{user.email}</span>
                </div>
              </div>

              {/* 오른쪽: 관리자 버튼 */}
              {user.uid === ADMIN_UID && (
                <button
                  onClick={() => navigate("/admin/logs")}
                  className="animated-gradient-admin px-4 py-2 rounded-lg text-base font-normal hover:brightness-110 transition"
                  style={{ fontWeight: 500, boxShadow: "none" }}
                >
                  관리자 로그
                </button>
              )}
            </div>

            {/* 활동 요약 카드 */}
            <div className="p-4 rounded-xl bg-white/10 shadow text-white text-sm font-normal select-none mb-0">
              <div className="flex justify-between mb-2 select-none">
                <span className="text-normal text-sm select-none">총 대화</span>
                <span className="text-normal text-sm select-none">{totalCount} 개</span>
              </div>
              <div className="flex justify-between mb-2 select-none">
                <span className="text-normal text-sm select-none">완성된 이야기</span>
                <span className="text-normal text-sm select-none">{completedCount} 개</span>
              </div>
              <div className="flex justify-between mb-2 select-none">
                <span className="text-normal text-sm select-none">오늘 사용한 토큰</span>
                <span className="text-normal text-sm select-none">
                  {tokenUsed.toLocaleString()} &nbsp;/&nbsp; {tokenLimit.toLocaleString()} &nbsp;( {tokenPercent}% )
                </span>
              </div>
              <div className="relative w-full bg-white/20 rounded h-2 overflow-hidden select-none">
                <div
                  className="absolute left-0 top-0 bg-green-300 h-2 rounded transition-all duration-500 select-none"
                  style={{ width: `${Math.min(tokenPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className={`flex justify-end ${buttonGroupGap} ${buttonTopMargin} select-none`}>
              <button
                onClick={goToHome}
                className={`
                  flex justify-center items-center
                  bg-white/10 text-white text-normal rounded-xl border-none transition select-none active:text-gray-300
                  ${buttonHeight} ${buttonTextSize} ${buttonPadding}
                  focus:outline-none
                  hover:shadow-[0_0_24px_0_rgba(255,255,255,0.7)]
                  active:shadow-[0_0_24px_0_rgba(255,255,255,0.7)]
                `}
              >
                ←
              </button>
              <button
                onClick={logout}
                className={`
                  flex justify-center items-center
                  bg-white/10 text-white text-normal rounded-xl border-none transition select-none
                  ${buttonHeight} ${buttonTextSize} ${buttonPadding}
                  focus:outline-none
                  hover:shadow-[0_0_24px_0_rgba(255,255,255,0.7)]
                  active:text-red-500 active:shadow-[0_0_24px_0_rgba(255,255,255,0.7)]
                `}
                style={{ }}
              >
                로그아웃
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center min-h-[200px] select-none">
            <span className="text-white text-normal text-sm animate-pulse select-none">로딩 중...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default MyPage;
