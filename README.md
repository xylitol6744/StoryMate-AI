# StoryMate AI

AI와 대화하며 꿈 이야기를 만들어가는 웹 기반 창작 서비스입니다.  
사용자는 AI와 주고받는 대화를 통해 자신만의 이야기를 이어가고,  
완성된 이야기는 저장하거나 PDF로 다운로드할 수 있습니다.

## 🚀 주요 기능

- Google 로그인 기반 사용자 인증  
- GPT-4 기반 이야기 생성 및 이어쓰기  
- 히스토리 페이지에서 대화 기록 및 완성된 이야기 열람  
- PDF 다운로드 기능  
- Firebase Firestore를 통한 실시간 데이터 저장

## 💻 사용 기술

| 분야         | 기술 스택                        |
|--------------|---------------------------------|
| 프론트엔드   | React, TypeScript, Vite, Tailwind CSS |
| 백엔드       | Firebase Auth, Firestore, OpenAI GPT API |
| 배포         | Vercel                          |
| 기타         | Framer Motion, Google OAuth, dotenv |

## ⚠️ 접속 시 보안 경고가 뜰 경우

본 프로젝트는 [Vercel](https://vercel.com)을 통해 배포되었으며, 기본 도메인(`.vercel.app`)은 HTTPS 기반으로 안전하게 연결됩니다.

하지만 **일부 와이파이 환경(학교, 기관, 특정 공유기 등)**에서는 HTTPS 연결이 차단되거나 TLS 인증서 문제가 발생할 수 있어 아래와 같은 경고가 표시될 수 있습니다:

> 🔒 "이 사이트는 보안 연결(HTTPS)이 사용되지 않았습니다"  
> 🚫 "ERR_SSL_PROTOCOL_ERROR", "ERR_TOO_MANY_REDIRECTS"

### ✅ 해결 방법

- **다른 와이파이 환경에서 접속**해보세요
- **인터넷 연결을 껐다가 다시 켠 후, 바로 재시도**해보세요.

해당 문제는 네트워크 환경의 제한 때문이며, 사이트 자체는 **정상적으로 보안 연결이 적용된 안전한 서비스**입니다.
