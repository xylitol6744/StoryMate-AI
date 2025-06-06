import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import admin from "firebase-admin";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";

import chatRouter from "./routes/chat";
import summaryRouter from "./routes/summary";
import storyRouter from "./routes/story";

import serviceAccount from "./serviceAccountKey.json";

// 환경 변수 적용
dotenv.config();

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const auth = admin.auth();
const firestore = admin.firestore();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Express 앱 설정
const app = express();
app.use(helmet());

// .env 또는 기본값으로 CORS origin 관리
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

// 요청 속도 제한 미들웨어
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  },
});
app.use(limiter);

// 공통 비동기 핸들러
function wrapAsync(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>
): express.RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// Firebase 인증 미들웨어
const authMiddleware = wrapAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "인증 토큰이 필요합니다." });
  }
  try {
    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(idToken);
    (req as any).uid = decoded.uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: "유효하지 않은 인증 토큰입니다." });
  }
});

// 인증 미들웨어 전체 적용
app.use(authMiddleware);

// API 라우터 등록
app.use("/api/chat", chatRouter(openai));
app.use("/api/summary", summaryRouter(openai));
app.use("/api/story", storyRouter(openai));

// 기본 응답 (테스트용)
app.get("/", (req, res) => {
  res.send("StoryMate AI Backend is running!");
});

// 최종 에러 핸들러 (로그/응답 일원화)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "서버 내부 오류", detail: err.message });
});

// 서버 실행
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

// 외부에서 사용 가능하게 export
export { wrapAsync, firestore, auth };
export default app;
