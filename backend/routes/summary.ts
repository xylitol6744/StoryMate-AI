import express, { Request, Response } from "express";
import { wrapAsync, firestore } from "../index";
import OpenAI from "openai";

declare module "express-serve-static-core" {
  interface Request {
    uid?: string;
  }
}

// 요약 프롬프트 상수
const SUMMARY_PROMPT = `
다음 대화를 요약하되, 인물과의 대화를 이어갈 수 있도록 필요한 정보만 정리해줘.

- 주요 인물, 장소, 사건의 흐름을 간결하게 정리해.
- 인물이 한 중요한 말이나 특징적인 발언은 실제 대사 형태("...")로 남겨줘.
- 감정 해석, 의미 분석, AI의 설명은 절대 넣지 마.
- 이후 대화에서 이 인물과 자연스럽게 상호작용할 수 있을 만큼만 요약해줘.
`;

const MODEL_NAME = "gpt-4o-mini";
const MAX_TOKENS = 777;
const TEMPERATURE = 0.5;

export default function summaryRouter(openai: OpenAI) {
  const router = express.Router();

  router.post(
    "/",
    wrapAsync(async (req: Request, res: Response) => {
      const { messages } = req.body;

      // 입력 검증
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "요약할 메시지 배열이 필요합니다." });
      }

      // 메시지 배열에서 'user:' 또는 'ai:'로 시작하는 메시지만 필터
      const flatten = (messages as string[])
        .filter((msg) => msg.startsWith("user:") || msg.startsWith("ai:"))
        .map((msg) => msg.split(":").slice(1).join(":").trim())
        .join("\n");

      // 실제 프롬프트 생성
      const prompt = `${SUMMARY_PROMPT}\n${flatten}`;

      // OpenAI 요약 호출
      const response = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [{ role: "user", content: prompt }],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      });

      const summary = response.choices?.[0]?.message?.content?.trim();

      if (!summary) {
        console.error("요약 실패:", response);
        return res.status(500).json({ error: "GPT 요약 실패" });
      }

      // 로그 저장 (실패 무시)
      try {
        await firestore.collection("logs").add({
          uid: req.uid ?? null,
          endpoint: "/api/summary",
          promptLength: prompt.length,
          tokensUsed: response.usage?.total_tokens || 0,
          timestamp: new Date(),
        });
      } catch (e) {}

      // 최종 응답
      res.status(200).json({ summary });
    })
  );

  return router;
}
