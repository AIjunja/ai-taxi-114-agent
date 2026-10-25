# 114 AI 택시 상담 PoC

02-114 '택시 대신 불러주기'의 반복 업무를 AI 음성 상담과 상담원 업무 웹 자동화로 처리하는 **개인 PoC**예요.
KT IS·카카오모빌리티의 공식 서비스가 아니고, 모든 배차는 가상이에요.

- 공개 데모: https://ai-taxi-114-agent.vercel.app
- 디자인 규칙: [DESIGN.md](DESIGN.md)
- 상담 스크립트 원안: [114-택시-대신-불러주기-상담-스크립트.md](114-택시-대신-불러주기-상담-스크립트.md)

## 무엇이 실제고 무엇이 Mock인가

| 기능 | 상태 | 설명 |
|---|---|---|
| 대화 엔진 (확인·승인) | 실시간 | `src/features/dialog/machine.ts`. 브라우저에서 동작 |
| 음성 인식·합성 | 실시간 | 브라우저 Web Speech API. 서버 키 없음 |
| 배차 | Mock | `api/dispatch.ts` (Vercel Function). 실제 택시 호출 없음 |
| 업무 웹 자동화 | 녹화 | `scripts/playwright-worker.ts`를 로컬에서 실제 실행해 녹화 |
| 자동 시연 | 합성 | 고객 발화는 미리 준비한 문장, AI 문장은 실제 대화 엔진 출력 |
| ROI 기본값 | 가정 | 공개 기사 수치 + 일반 가정. 내부 원가 아님 |

## 구조

```
src/features/dialog     대화 상태 기계, 장소 인식, 예/아니요 판별
src/features/demo       자동 시연 시나리오와 플레이어
src/features/try        직접 체험 (마이크·글 입력)
src/features/console    상담원 업무 웹 (/console) — Worker가 조작하는 화면
src/features/roi        비용 계산과 시뮬레이터
server/dispatch-core.ts Mock 배차: 승인 검사, 중복 방지, 요청량 제한
api/dispatch.ts         Vercel Function 진입점
scripts/playwright-worker.ts  업무 웹 자동화 Worker + 증빙 녹화
```

## 실행

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # 단위 테스트 (Vitest)
npm run test:e2e         # E2E (Playwright, 데스크톱·모바일)
npm run record:worker    # Worker 실행 녹화 → public/evidence/
```

## 안전장치

- 승인 없는 호출 거절: 대화 엔진, 화면, 서버(403), Worker 네 곳
- 같은 요청 키는 새로 배차하지 않음. 다른 세션의 키 재사용은 409
- IP별 10분 20회 제한. 장소는 미리 정한 ID만 받음
- Worker는 localhost만 열고 다른 호스트 요청은 차단. 동시 1개, 30초 제한
- `DISPATCH_DISABLED=1`이면 서버 배차를 멈추고 브라우저 내 Mock으로 전환
- 음성·대화 미저장. 서버 로그에는 결과 종류만 남김

## 공개 환경의 한계

- 서버리스 메모리라 요청량 제한과 중복 방지 키는 인스턴스마다 따로예요.
- 공개 사이트에서는 Playwright를 실시간 실행하지 않고 녹화를 보여줘요.
- 음성 인식은 Chrome·Edge 중심이에요. 이 브라우저들은 인식을 위해 음성을 브라우저 회사 서버로 보낼 수 있어요.
- 장소는 데모용 24곳만 알아들어요.
