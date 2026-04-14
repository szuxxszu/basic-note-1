# 🕒 Project Checkpoint (2026-04-14)

- **Current Milestone**: Phase 4 완료, Supabase 실시간 동기화 완료
- **Key Achievements**:
  - Phase 1: 기반 구축 (패키지 설치, 타입/DB/상수 정의, Provider, 앱 셸+사이드바+라우팅)
  - Phase 3: 데이터 CRUD + AES-256-GCM 암호화 (노트/카테고리/블록 생성·수정·삭제)
  - Phase 4: 블록 에디터 (8종 블록: text/heading/bullet/numbered/todo/divider/quote/code, 키보드 핸들링, @dnd-kit 드래그앤드롭, 슬래시 명령 메뉴)
  - Supabase 동기화: Realtime 즉시 sync + 60초 주기 fallback pull, 기기 간 비밀번호/데이터 공유
  - 버그 수정: useLiveQuery null/undefined 구분, IndexedDB null 인덱싱, 슬래시 명령 "/" 충돌, 블릿 Enter debounce 문제

- **Pending Tasks**:
  - Phase 5: 뷰 시스템 (캘린더 뷰, 카테고리 트리 뷰, 뷰 전환 탭)
  - Phase 6: PWA/오프라인 (Service Worker, manifest.json)
  - Phase 7: 설정 페이지, 내보내기/가져오기, 토스트 알림, 키보드 단축키, 모바일 대응

- **Technical Decisions**:
  - 저장소: Dexie.js (IndexedDB) + Supabase (PostgreSQL, 도쿄 리전)
  - 암호화: Web Crypto API, PBKDF2 600K iterations, AES-256-GCM
  - 동기화: 로컬 우선 → 변경 시 즉시 push → Supabase Realtime으로 다른 기기에 즉시 전파
  - 블록 에디터: 커스텀 contentEditable (Tiptap/BlockNote 미사용, dx-kit 규칙 준수)
  - 드래그앤드롭: @dnd-kit + fractional-indexing
  - static export 대신 서버 사이드 유지 (Supabase 연동)

- **Agent Notes**:
  - Supabase URL: https://yjguaevkaymidxvllioo.supabase.co
  - Supabase anon key: .env.local에 저장됨
  - Supabase 테이블: encrypted_entities (RLS + Realtime ON), app_settings (RLS ON)
  - dev 서버 포트: 3003 (3000번 충돌)
  - git 미초기화 상태 (.gitignore 없음)

## 파일 구조 요약
```
app/
  layout.tsx, page.tsx (→ /notes 리다이렉트)
  notes/ (layout.tsx + page.tsx + [noteId]/page.tsx + calendar/page.tsx + categories/page.tsx + categories/[categoryId]/page.tsx)
  settings/ (layout.tsx + page.tsx)
components/
  providers/ (db-provider, crypto-provider, auth-gate)
  sidebar/ (app-sidebar, category-tree)
  notes/ (note-list, note-list-item)
  editor/ (block-editor, block-renderer, block-types, note-title, slash-command-menu, blocks/*)
  dialogs/ (category-dialog)
  lock-screen.tsx
hooks/ (use-notes, use-blocks, use-categories)
lib/ (db, types, constants, crypto, fractional-index, supabase, sync/engine)
```
