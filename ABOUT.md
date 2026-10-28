# GitHub About — 프로젝트 소개

GitHub 저장소 오른쪽 **About** 영역에 표시될 내용을 정리했습니다. `github-bootstrap.cmd`를 사용하면 **Description / Website / Topics가 자동으로 설정**됩니다. GitHub의 Repository Social Preview 이미지는 수동 등록이 필요합니다.

## Repository

**Name** `target-tab-auto-clicker` (또는 사용자가 명령에 입력한 저장소 이름)

**Description (복사해서 사용)**

> Monitor selected Chrome tabs and automatically click Continue buttons when enabled. Multi-URL lists, per-tab controls, local settings.

**Website**

`https://GITHUB_USERNAME.github.io/REPOSITORY_NAME/`

`github-bootstrap.cmd`는 로그인한 GitHub 사용자명과 입력한 저장소 이름으로 위 주소를 자동 계산합니다. 본인 계정의 `USERNAME.github.io` 특별 저장소는 루트 주소를 사용합니다. GitHub Pages 배포 후 실제 사이트가 열리는지 확인하세요.

**Topics**

`chrome-extension`, `manifest-v3`, `browser-automation`, `auto-clicker`, `tab-manager`, `javascript`, `github-pages`, `open-source`

자동 적용되는 Description과 Topics는 `github-bootstrap.cmd` 상단의 `ABOUT_DESC`, `ABOUT_TOPICS`를 수정하세요. [`scripts/repository-about.json`](scripts/repository-about.json)은 참고용 메타데이터입니다.

## Social Preview (수동 등록)

1. GitHub 저장소 **Settings → General** 이동
2. **Social preview → Edit** 클릭
3. `docs/repository-social-preview.png` 이미지 선택
4. 저장 후 카드 미리보기 확인

[미리보기 PNG](docs/repository-social-preview.png)

## 프로젝트 요약

- **누구를 위한 도구인가?** 여러 웹페이지의 `계속` / `Continue` 버튼을 일일이 확인하기 어려운 사용자를 위한 Chrome 도구
- **핵심 기능은?** 최대 50개 URL 목록, 개별 ON/OFF, 탭 재연결, 활성화 감지, 중복 클릭 방지 및 클릭 기록
- **어디서 실행되나?** Chrome 데스크톱의 확장프로그램 (GitHub Pages는 설치·안내 사이트)
- **데이터는 어디에 있나?** 등록한 URL·설정은 브라우저 로컬 저장소에 보관; 별도 운영 서버 없음
- **주의할 점은?** Chrome의 메모리 절약/절전 또는 외부 서비스 UI 변경에 따라 자동 클릭이 중단되거나 지연될 수 있음. 해당 사이트의 이용약관을 준수해야 함.

프로젝트는 ChatGPT 또는 Claude의 공식 제품이 아니며, 각 서비스와 제휴하지 않았습니다.
