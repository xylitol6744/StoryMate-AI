import { useEffect } from "react";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth, provider } from "../firebase";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch (error) {
      console.error("로그인 실패:", error);
    }
  };

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
      className="min-h-screen w-full flex items-center justify-center bg-transparent"
    >
      <div className="w-full max-w-md flex flex-col items-center justify-center min-h-screen">
        <div className="w-full text-center space-y-10 bg-black/30 px-8 py-14 rounded-2xl shadow-2xl backdrop-blur-md">
          <h1
            className="select-none text-2xl md:text-3xl font-normal mb-8 text-white drop-shadow"
            style={{
              fontFamily: "'DNFBitBitv2'",
              letterSpacing: "2px",
              textShadow: "0 2px 16px rgba(0,0,0,0.24)",
            }}
          >
            StoryMate AI 로그인
          </h1>
          <button
            onClick={loginWithGoogle}
            className="
              w-full max-w-xs mx-auto flex items-center justify-center gap-2
              bg-white border border-gray-200 rounded-xl px-6 py-3
              font-normal text-gray-700 shadow transition
              hover:shadow-[0_0_16px_0_rgba(255,255,255,0.8)]
              hover:border-gray-300
              focus:outline-none focus:ring-0 focus:border-gray-300
            "
          >
            <svg
              className="w-6 h-6 mr-2"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clipPath="url(#clip0_17_40)">
                <path
                  d="M47.9997 24.5521C47.9997 22.7868 47.8506 21.444 47.6256 20.0555H24.479V28.4436H37.9132C37.6525 30.3981 36.3739 33.1376 33.5451 35.0478L33.5058 35.3125L40.4876 40.6895L41.0062 40.7405C45.1101 37.0038 47.9997 31.3257 47.9997 24.5521Z"
                  fill="#4285F4"
                />
                <path
                  d="M24.479 47.9998C31.1046 47.9998 36.6786 45.9159 41.0062 40.7405L33.5451 35.0478C31.5778 36.4455 28.9411 37.4827 24.479 37.4827C17.9941 37.4827 12.4143 33.2289 10.4851 27.8352L10.2281 27.8578L2.94247 33.4022L2.84302 33.6446C7.14308 41.0324 15.1292 47.9998 24.479 47.9998Z"
                  fill="#34A853"
                />
                <path
                  d="M10.4851 27.8352C10.0012 26.4478 9.71508 24.9631 9.71508 23.4273C9.71508 21.8914 10.0012 20.4067 10.4662 19.0194L10.4536 18.7408L3.07422 13.0713L2.84302 13.2098C1.03438 16.4849 0 20.0457 0 23.4273C0 26.8088 1.03438 30.3695 2.84302 33.6446L10.4851 27.8352Z"
                  fill="#FBBC05"
                />
                <path
                  d="M24.479 9.37195C29.1075 9.37195 32.1271 11.3392 33.8928 12.9155L41.1666 6.03067C36.6651 1.79461 31.1046 0 24.479 0C15.1292 0 7.14308 6.96737 2.84302 13.2098L10.4662 19.0194C12.4143 13.6257 17.9941 9.37195 24.479 9.37195Z"
                  fill="#EA4335"
                />
              </g>
              <defs>
                <clipPath id="clip0_17_40">
                  <rect width="48" height="48" fill="white" />
                </clipPath>
              </defs>
            </svg>
            <span className="select-none">Google로 계속하기</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default Login;
