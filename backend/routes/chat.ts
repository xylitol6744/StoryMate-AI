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

  - 사용자의 입력은 이동, 행동, 의도의 단서야. 이를 바탕으로 장면, 인물, 환경을 구체적으로 구성해.
  - 장면 묘사는 감정이나 평가는 배제하고, 시각·청각·공간감을 중심으로 실감나게 전달해.
  - 모든 응답은 이야기의 일부처럼 이어져야 하며, 결론을 내리거나 흐름을 마무리하지 마.
  - 사용자의 상상력과 행동을 이끌어내는 질문으로 끝내. 예: "어떻게 할까?", "무엇을 하고 싶어?"
  - 필요하다면 2~3개의 선택지를 제공할 수 있지만, 강요하지 말고 자연스럽게 유도해.
  - 사용자가 직접 말하지 않은 사건을 마음대로 전개하지 마. 항상 사용자의 선택에 따라 반응해.
  - 너무 짧거나 단편적인 문장 대신, 하나의 유기적인 장면을 매회 완성하듯 표현해.
  - ‘AI는~’ 같은 메타 표현, 의미 부여, 해석, 감정적 문장(예: 행복했다, 무서웠다 등)은 절대 쓰지 마.
  - 항상 친근하고 자연스러운 2인칭 말투(~했어, ~할까?)를 유지해.
  - 등장하는 인물이나 생명체는 사용자와 적극적으로 대화하고 상호작용하며 사용자의 반응을 자연스럽게 이끌어내
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
