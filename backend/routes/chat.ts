import express, { Request, Response } from "express";
import { wrapAsync, firestore } from "../index";
import OpenAI from "openai";

declare module "express-serve-static-core" {
  interface Request {
    uid?: string;
  }
}

// 시스템 프롬프트 및 상수 분리
const SYSTEM_PROMPT = `
너는 사용자의 꿈 속 세계를 함께 탐험하는 인터랙티브 스토리텔링 파트너야.

- 친근하고 자연스러운(당신은x 너는o) 2인칭 말투를 사용해줘.
- 모든 문장을 절대 "다."로 끝내지 말아줘.
- 사용자의 입력은 행동과 의도의 단서야. 그걸 바탕으로 상황과 인물, 공간감을 실감 나게 묘사해줘.
- 감정적 표현이나 해석 없이, 시각적·청각적·공간적 요소 중심으로 장면을 묘사해줘.
- 대화는 이야기의 일부처럼 이어지도록 하고, 절대 결론을 내리거나 흐름을 마무리하지 말아줘.
- 사용자가 상상하고 움직이도록 유도하는 질문으로 자연스러운 2인칭 말투를 사용해 자연스럽게 끝맺어줘. 예를 들면, "~하는건 어때?" “~해볼래?”, “~해봐도 좋아” 같은 식이야.
- 때로는 선택지를 제시하되, 절대 번호나 기호를 쓰지 말고 문장 속에서 부드럽게 연결해줘.
- ‘AI는~’ 같은 메타 표현이나 의미 해석, 감정(예: 기뻤다, 두려웠다)은 절대 쓰지 말아줘.
- 등장하는 생명체나 인물은 너와 적극적으로 대화하고 상호작용하며, 자연스럽게 사용자의 반응을 유도해줘.
- 너가 ai로서 사용자와 대화, 공감하지 말아줘.
- 한글로만 대화해줘.
`;

const TOKEN_LIMIT = 70000;
const MAX_TOKENS = 444;

export default function chatRouter(openai: OpenAI) {
  const router = express.Router();

  router.post(
    "/",
    wrapAsync(async (req: Request, res: Response) => {
      const { summary, context, userMessage } = req.body;
      const userId = req.uid;

      // 인증 체크
      if (!userId) {
        return res.status(401).json({ error: "인증 정보가 없습니다." });
      }
      // 입력값 체크
      if (!userMessage || typeof userMessage !== "string") {
        return res.status(400).json({ error: "userMessage가 누락되었습니다." });
      }

      // 날짜/키 구성
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate());
      const monthKey = `${year}-${month}`;

      // 토큰 사용량 조회
      const usageRef = firestore
        .collection("users")
        .doc(userId)
        .collection("tokenUsage")
        .doc(monthKey);

      const usageSnap = await usageRef.get();
      const usageData = usageSnap.exists ? usageSnap.data() : {};
      const countByDay = usageData?.countByDay ?? {};
      const todayUsed = Number(countByDay[day] || 0);

      if (todayUsed >= TOKEN_LIMIT) {
        return res.status(429).json({
          error: "오늘의 토큰 사용량 한도를 초과했습니다.",
          tokenUsed: todayUsed,
          tokenLimit: TOKEN_LIMIT,
        });
      }

      // 메시지 생성 (summary/context 옵션 처리)
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      if (summary) {
        messages.push({ role: "user", content: summary });
      }
      if (context) {
        messages.push({ role: "user", content: context });
      }
      messages.push({ role: "user", content: userMessage });

      // OpenAI 호출
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.9,
        max_tokens: MAX_TOKENS,
      });

      const reply = response.choices[0].message?.content?.trim() || "AI 응답이 없습니다.";
      const tokens = response.usage?.total_tokens || 0;

      // 한도 초과 재확인
      if (todayUsed + tokens > TOKEN_LIMIT) {
        return res.status(429).json({
          error: "이번 요청으로 오늘의 토큰 사용량 한도를 초과합니다.",
          tokenUsed: todayUsed,
          tokensRequested: tokens,
          tokenLimit: TOKEN_LIMIT,
        });
      }

      // Firestore 토큰 사용량 트랜잭션 갱신
      await firestore.runTransaction(async (t) => {
        const usageDoc = await t.get(usageRef);
        const prev = usageDoc.exists ? usageDoc.data()?.countByDay ?? {} : {};
        const oldCount = Number(prev[day] || 0);
        t.set(
          usageRef,
          {
            countByDay: {
              ...prev,
              [day]: oldCount + tokens,
            },
          },
          { merge: true }
        );
      });

      // 로그 기록 (에러 무시)
      try {
        await firestore.collection("logs").add({
          uid: userId,
          endpoint: "/api/chat",
          promptLength: JSON.stringify(messages).length,
          tokensUsed: tokens,
          timestamp: new Date(),
        });
      } catch (e) {}

      // 최종 응답
      res.status(200).json({ reply, tokensUsed: tokens });
    })
  );

  return router;
}
