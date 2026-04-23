# 🕒 Project Checkpoint (2026-04-24)

## Current Milestone
**Phase 10 — 에디터 아키텍처 전환, 크립토 다중탭 방어, 노트 리스트 일관화**

지난 체크포인트(`3914527` Phase 9) 이후 이번 세션에서 **35 커밋**, 전부 main 푸시 + Vercel 프로덕션 자동 배포 완료. 최신: `ccfd273`.

Production: https://pro03note.vercel.app · Repo: https://github.com/plusxdev/pro-03-note

---

## Key Achievements

### Phase 10-A · 크립토 다중탭 방어 (보안 크리티컬)
사용자 재현 보고: "밤사이 자고 일어나면 프로덕션 접속 시 전체 노트가 복호화 실패, 새로고침하면 해결". 원인 추적 결과 **다중 Chrome 탭 간 cryptoKey 동기화 불일치**.

시나리오: 탭 A에서 reset+재setup(새 마스터키 M2)하면, 리셋 전 열려있던 탭 B/C는 메모리에 M1을 그대로 쥐고 있고, IndexedDB는 공유라 M2 settings를 보게 되어 key/data 불일치.

**구현**
- `lib/decrypt-diagnostics.ts` 신설 — 다음 실패 시 `bn_decrypt_fail_log` localStorage에 컨텍스트(online, visibility, wrapper fingerprint, ciphertext prefix) 스냅샷 기록.
- `crypto-provider.tsx`에 `loadedWrapperRef` 추가 — 언래핑 시점의 `encryptedMasterKey`를 보관. settings가 drift하면 자동 `lock()`.
- `BroadcastChannel("bn_crypto")` 구현:
  - `lock` / `reset` → 수신 탭 무조건 드롭
  - `setup` / `unlock` → sender wrapper와 receiver의 `loadedWrapperRef` 비교해 같으면 no-op, 다르면 드롭 (unlock이 다른 탭을 불필요하게 밀어내지 않음)
- `lib/reset.ts`에도 wipe 전에 `{type:"reset"}` 브로드캐스트 추가
- idle auto-lock 시 `autoUnlockAttempted.current = false`로 리셋 → 세션 pw 있으면 다음 interaction 시 자동 재언락
- 모든 훅 catch에서 `"App is locked"` 일시 에러는 빈 문자열 처리 → 끈적한 "(복호화 실패)" 표시 차단
- 노트 상세 title decrypt에 `isUnlocked` 가드 추가

**검증 결과**: 사용자 "배포 이후로 복호화 실패는 없었어" 확인.

메모리: `project_crypto_multitab.md` 기록.

### Phase 10-B · 블록 에디터 → PlainEditor 전환 (큰 리팩터)
**문제**
- Enter 시 옛 블록 DOM이 stale 상태로 잔존 → 한 프레임 깜빡임
- dnd-kit `useSortable`이 rawBlocks 변경마다 재평가 → 7-8줄 동시 깜빡임
- 각 블록이 독립 `contentEditable`이라 **라인 간 네이티브 선택 불가**

**교체 전 시도** (초반에 기존 구조 유지 시도)
- `useBlocks`에 `decryptCacheRef` (ciphertext → plaintext) → Enter 지연 절반 감소
- `contentOverrides` Map state로 updateBlock 결과를 React state에 즉시 반영 → 추가 flicker 제거
- `prevDecryptedRef`로 블록 객체 reference 보존 → dnd-kit 리렌더 억제
- `SortableBlock.style.transition`은 `isDragging` 시에만 적용
- 각 블록에 onBlur 동기화 추가 + `contentRef`로 최신 content 보관
- Backspace merge를 동기 DOM 조작으로 전환

**최종 결정** — 사용자 "애플 노트 타겟" 방향 제시 → 구조 자체 교체.

**PlainEditor (`components/editor/plain-editor.tsx`)**
- 단일 HTML contentEditable (`contentEditable="true"`, `innerHTML` 저장)
- **Note.content** 필드 추가 (암호화된 HTML 문자열)
- 자동 마이그레이션: 기존 블록들을 첫 진입 시 `<h1/2/3>`, `<ul><li>`, `<div>`로 재구성해 `content`에 저장
- 레거시 plaintext(`• ` prefix 포함) → HTML 자동 변환
- `forwardRef` + `useImperativeHandle`로 외부 명령:
  - `execBold`, `execItalic`, `execUnderline`, `execStrikethrough`
  - `setHeading(1|2|3|null)` — `formatBlock` 래퍼
  - `toggleBulletAtCaret`, `toggleNumberedAtCaret` — `insertUnorderedList`/`insertOrderedList`
- 키보드 쇼트컷 Cmd/Ctrl+B/I/U
- 400ms debounced encrypt + Dexie write + syncPushEntity

**툴바 (노트 상세 상단)**
- 구성: 텍스트크기(드롭다운: 제목 1/2/3 / 본문) → 블릿 → Bold → Italic → Underline → Strikethrough
- 레이아웃: 3-컬럼(`absolute left-1/2 -translate-x-1/2`로 중앙). 왼쪽 `← 뒤로`, 오른쪽 `⋯`

**스타일 (globals.css .rich-editor)**
- `h1`(1.5rem), `h2`(1.25rem), `h3`(1.1rem), `ul`/`ol`(pl 1.5rem), `li`, `hr`
- `break-words overflow-x-hidden`으로 긴 단어가 부모 폭 안 넘김

### Phase 10-C · 노트 리스트 재구성 + 추상화
**레이아웃**
- 리스트 아이템 우측 2줄: 상단 폴더명, 하단 생성일(`yyyy.MM.dd`)
- 좌우 baseline 자동 정렬: CardAction 대신 각 행을 `flex items-baseline`으로 구성 (title + folder, preview + date)
- `⋯` 버튼은 CardAction에 남겨두고 `self-center` + `ml-[5px]`
- 날짜 `-mt-[2px]`, 폰트 `text-sm`(14px)로 좌측 preview와 통일
- preview는 `note.content` 우선 (HTML → DOMParser로 텍스트 추출), legacy block fallback

**추상화: `components/notes/note-card.tsx`**
- `NoteCard({ note })`이 `useNotes`/`useCategories`에서 필요한 모든 핸들러 자동 주입
- 기존 문제: calendar·categories 페이지가 `NoteListItem`에 `onTogglePin`/`onDelete`를 prop drill 안 해서 핀/삭제 동작 안 함
- 해결: 모든 리스트 사용처(`note-list.tsx`, `calendar/page.tsx`, `categories/page.tsx` × 2) → `<NoteCard note={note} />`로 교체. 프롭 누락 버그 구조적 차단.

### Phase 10-D · UI 세부 정렬
- 사이드바 토글을 사이드바 내부 로고 우측으로 이동, 접힘(`collapsible=icon`) 시 토글만 노출
- 로고 상단(+5px) / 푸터 하단(+8px) 여백 조정
- 전 영역 아이콘 `h-4 w-4` (16px)로 통일
- 드롭다운 `min-w-[166px]` (30% 확대)
- 상단 `/notes/*` 탭 nav `mt-0.5`
- 노트 상세 헤더 2줄 → 1줄 (카테고리 / 생성일), 아이콘 제거, 간격 미세조정
- 뒤로가기 `router.push("/notes")` → `router.back()` (원래 페이지로 복귀)
- 제목-본문 여백 축소: `gap-6`(24px) + `-mt-[18px]` = 실효 6px

### Phase 10-E · 브라우저 제스처 복원
증상: macOS Safari/Chrome 좌→우 스와이프 뒤로가기가 노트 상세에서 미동작.
원인: 가로 elastic overscroll이 제스처 가로챔.
수정: `app/notes/layout.tsx` main에 `overflow-x-hidden overscroll-x-none`, PlainEditor에 `break-words overflow-x-hidden`.

---

## Technical Decisions

| 결정 | 이유 |
|---|---|
| PlainEditor 단일 contentEditable | 라인 간 선택, 네이티브 Enter/Backspace, 리렌더 성능 — 블록 단위 CE의 구조적 한계 |
| HTML 저장 (innerHTML) | Bold/Italic/헤딩/리스트 등 네이티브 리치 텍스트 지원 |
| `document.execCommand` 사용 (deprecated) | Chrome/Safari/Firefox 모두 안정 동작, 사용자 Chrome only |
| NoteCard 래퍼 | prop drill 누락 버그 재발 차단, 새 리스트 페이지 추가 비용 ↓ |
| BroadcastChannel wrapper 비교 방식 | paranoid 일괄 락은 UX 거슬림 — 실제 key 변경 시에만 락 |
| 뒤로가기 `router.back()` | 다양한 진입 경로(전체/카테고리/캘린더/검색) 보존 |
| Note.content 필드 추가 (block 테이블은 legacy로 유지) | 마이그레이션 롤백 여지 확보 |

---

## Pending Tasks (다음 세션 즉시 시작 순)

### 높음
1. **Realtime sync 누수 근본 차단** — `lib/sync/engine.ts`의 `handleRealtimeChange`가 `LAST_SYNC_KEY` 컷오프를 체크하지 않아 옛 암호문 재유입 가능. 이번 세션은 증상(stale cryptoKey) 차단만 했고 원인은 남음. `updated_at <= LAST_SYNC_KEY` row 스킵 로직 추가 필요.
2. **레거시 블록 시스템 정리** — Block 테이블 / 블록 컴포넌트 7개 / dnd-kit / slash-command-menu / mobile-block-menu 등 미사용 코드 제거. 지금은 마이그레이션만 잔존, 실행은 거의 없음. 모든 노트 마이그레이션 확인 후 삭제.
3. **자동 불릿 변환 (`- ` → `• `) 재구현** — plaintext-only 시절 구현한 로직이 HTML 전환 후 미검증. `keydown` 시 현재 라인의 Range를 읽어 `insertUnorderedList` 호출하는 방식으로 재작성.

### 중간
4. **진단 로깅 실전 확인** — `bn_decrypt_fail_log`가 실제 발동할 때의 덤프 확보 (배포 후 증상 소멸로 대기 중).
5. **다중 노트 선택/일괄 작업** — 애플 노트처럼 여러 노트 동시 삭제/이동. `NoteCard` 경로로 이미 추상화돼 있어 확장하기 쉬움.
6. **헤딩 현재 상태 표시** — 툴바 드롭다운에서 현재 라인의 heading level 체크 표시.

### 낮음 (UX)
7. 애플 노트의 하이라이트(형광펜), 링크 삽입, 이미지/첨부. execCommand 기반으로 계속 가면 modernize 어려움 → 규모 커지면 TipTap 등 고려.
8. 자동 백업 / 버전 히스토리.

---

## Agent Notes

### Director
- 세션 작업량: 35 커밋 / 약 5개 카테고리. 모두 production 배포.
- 커밋 메시지 규칙: 한글, 의도 중심, `Co-Authored-By: Claude Opus 4.7 (1M context)` 푸터.
- 워크플로: 각 수정 → `npm run build` (타입 체크) → `git commit` → `git push origin main` → `vercel --prod --yes`. 사용자 승인 하에 자동 묶음.

### Frontend / Backend
- **에디터 아키텍처 교체는 신중하게**: PlainEditor 전환은 사용자가 명시적으로 "애플 노트 타겟" 방향을 제시한 후 진행. 그 전까진 블록 구조를 최대한 보존하려 여러 패치 시도(캐시/optimistic/ref 안정화).
- **데이터 손실 방지**: 블록 → HTML 마이그레이션은 첫 진입 시 자동, 결과를 encrypt해 `note.content`에 저장. 블록 자체는 건드리지 않아 롤백 가능.
- **build → commit → push → deploy** 습관화: 각 커밋이 Vercel에 즉시 반영돼 사용자 테스트 루프가 빠름.

### Designer
- 사용자 선호: px 단위 미세 조정 요청 많음 (mt-[2px], ml-[5px] 등). 새 기능 추가 시 이 톤 유지.
- 애플 노트 시각 언어 참고가 뚜렷함.

### Security
- 크립토 다중탭 방어 패턴(`project_crypto_multitab.md`) **절대 되돌리지 말 것**. Paranoid 일괄 락 회귀 시 UX 파괴. Wrapper fingerprint 비교 기반 조건부 락이 정답.
- `lib/sync/engine.ts`의 realtime 누수는 여전히 열려 있음 → 다음 세션 우선 1번.
- 진단 로깅 존재 기억: `JSON.parse(localStorage.getItem("bn_decrypt_fail_log"))`.

### Performance
- PlainEditor 전환 후 에디터 관련 리렌더/깜빡임은 전부 해소. 노트당 AES-GCM decrypt 1회.
- 리스트 preview는 `decryptCacheRef`로 재복호화 억제 (`use-notes.ts`).

---

## 주요 커밋 이력 (최근 순)

```
ccfd273 NoteCard 추상화: 리스트 전역에서 pin/delete 일관 지원
eefece1 노트 리스트 우측 날짜 -mt-px → -mt-[2px]
9b7c537 노트 리스트 우측 날짜 1px 위로
a58e04d 좌우 elastic overscroll 제거 (뒤로가기 제스처 복구)
759a917 노트 리스트 ... 버튼 왼쪽 여백 5px 추가
e0dc289 노트 리스트 좌우 baseline 자동 정렬 (구조 재배치)
0f10293 노트 리스트 폴더명 상단 여백 mt-1 → mt-1.5
f1b6d3a 노트 리스트 우측 폰트 12 → 14로 맞춤
d612ff5 노트 리스트 폴더명 상단 여백 4px 추가
1c66b96 노트 리스트 우측 2줄, 좌측 타이틀/설명 라인에 맞춰 정렬
4357e1a 노트 리스트 우측 2줄 + ... 버튼 중앙정렬
6823949 제목-본문 간격 다시 절반 축소
7b69e40 툴바 배치: 중앙 정렬 + 순서 재배열 + 제목 아래 여백 축소
a559c73 리치 텍스트 편집: 볼드/이탤릭/밑줄/취소선 + 헤딩 + 리스트
713bf0e 불릿 자동 변환 + 툴바 불릿 토글 버튼
3d6f0e8 단일 contentEditable 에디터로 전환 (애플 노트 스타일)
674823a 드래그 중 아닐 땐 dnd-kit transition 비활성
5e5759d Enter split 블록 잔여 깜빡임 제거
fd9cf58 Enter 시 위 블록들 flicker 제거
7cdf7fc updateBlock에 contentOverrides 추가
b290739 useBlocks optimistic 상태 + 리스트 preview 빈 블록 스킵
2e4238c useBlocks에 복호화 캐시 추가
5b8805f 백스페이스 merge 동기 실행으로 즉각 반응
f18abcd 백스페이스 라인 시작점 병합 제거, 단순 커서 이동으로 변경
b2deab1 블록 DOM 동기화를 onBlur로 이전
ccf8467 블록 시작점에서 백스페이스 시 이전 블록에 병합
9e8d9da 텍스트 블록 placeholder 제거
06f85de 상세 헤더 간격 미세 조정
f0993ca 상세 헤더 카테고리/날짜 앞 아이콘 제거
6403813 상세 헤더 달력 아이콘과 날짜 간격 축소
078a02d 노트 상세 헤더 2줄 → 1줄 정리
ad6ad9a 노트 리스트 아이템: 날짜 포맷 변경 + 액션 메뉴 확장
8c799f3 노트 상세 뒤로가기 버튼을 브라우저 히스토리 기반으로 변경
6a11057 언락 broadcast 시 같은 마스터키면 다른 탭 유지
a342ab3 크립토 다중탭 방어 + 에디터 race 수정 + UI 정렬 개선
```

---

## Deployment Cadence
권장: 수정 → 로컬 `npm run build` → `git commit` → `git push` → `vercel --prod --yes`. 전부 자동 한 묶음.
다음 세션에서 사용자가 "자동 배포 계속 / 수동 전환" 선택.

## 환경 참고 (Phase 9 체크포인트에서 계승)
- Supabase URL: https://yjguaevkaymidxvllioo.supabase.co (dev/prod 공유, SYNC_ENABLED 가드로 dev 차단)
- Vercel 프로젝트: kihyun-5528s-projects/pro_03_note
- Vercel 도메인: https://pro03note.vercel.app
- dev 서버: 3003 포트, Node 25 (`/opt/homebrew/opt/node@25/bin`)
- dev sync 필요 시: `.env.local`에 `NEXT_PUBLIC_ENABLE_SYNC=true`

## 메모리 인덱스
- `project_securenote.md` — 프로젝트 개요
- `project_crypto_multitab.md` — **다중탭 방어 패턴 (Phase 10 핵심, 절대 되돌리지 말 것)**
- `project_block_editor.md` — legacy 블록 에디터 패턴 (PlainEditor 전환 후 레퍼런스 용도)
- `user_profile.md` — 한국어, 보안 중시, 간결 답변
- `feedback_port.md` — dev 3003 포트

## Phase 9 이전 성과 요약 (축약)
Phase 1~8: 기반 구축, 마스터키 아키텍처, i18n, UI 전반.
Phase 9: 이중 암호화 버그 수정, `looksLikeCiphertext`, 데이터 리셋, dev/prod sync 분리, 모바일 스크롤 프리징 해결, 모바일 블록 에디터(FAB+Drawer), 블록 에디터 커서/IME/Enter 분할.
