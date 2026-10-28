# Changelog

## GitHub publisher adjustment · 2026-10-28

- Attached `github-bootstrap.cmd` workflow adopted: separate `github-bootstrap.cmd`, `github-update.cmd`, and `git-safe-sync.cmd`.
- Git root verification and fast-forward-only sync prevent accidentally pushing an ancestor Git repository or overwriting remote history.
- Chrome extension feature version remains v3.0.0.

## Publisher hotfix · 2026-10-28

- Windows CMD 게시 스크립트가 상위 폴더의 Git 저장소를 감지했을 때, 프로젝트 폴더가 상위 저장소에서 추적되지 않은 경우에는 독립적인 로컬 Git 저장소를 생성합니다.
- 상위 저장소가 프로젝트 파일을 이미 추적하면 안전하게 중단하며 폴더 이동 방법을 안내합니다.
- 확장프로그램 자체 기능 버전은 3.0.0으로 유지됩니다.


## v3.0.0 (2026-10-28)

- 단일 URL에서 **최대 50개의 URL 목록**으로 확장
- URL별 버튼 문구 및 개별 ON/OFF
- 목록 추가·삭제, 탭 재연결, 개별 클릭 기록, 전체 감시 ON/OFF
- 기존 v2 저장 설정을 동일 확장프로그램 업데이트 시 목록으로 이전
- GitHub Pages 설치 안내와 확장프로그램 ZIP 자동 생성 및 배포 구성

## v2.0.0

- 하나의 대화 URL과 대상 탭을 연결하여 추적
- 백그라운드 탭 감시 및 권한 확인

## v1.0.0

- ChatGPT 안내 영역의 `계속` 버튼 활성화 감지 및 자동 클릭
