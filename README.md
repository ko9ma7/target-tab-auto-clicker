<div align="center">

<img src="icons/icon128.png" width="84" alt="Target Tab Auto Clicker 아이콘">

# Target Tab Auto Clicker

### 원하는 페이지의 `계속` 버튼을 자동으로 감시하세요

**여러 URL 등록 · 기본 5시간 예약 확인 · 닫힌 탭 자동 열기 · 반복 클릭 기록**

![Version](https://img.shields.io/badge/version-4.0.0-3156e5) ![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-2345c9) ![License](https://img.shields.io/badge/license-MIT-14745c) ![Build](https://img.shields.io/badge/build-Python%20stdlib-lightgrey)

Chrome에서 지정한 웹페이지의 버튼이 비활성화되었다가 활성화되면 자동으로 클릭하는 **무료·로컬 실행** 확장프로그램입니다. 별도의 서버나 계정이 필요하지 않습니다.

[빠른 GitHub 공개](#-windows-cmd로-github에-올리기) · [설치 방법](#-설치-방법) · [사용 방법](#-사용-방법) · [문제 해결](#-문제-해결)

</div>

---

## 🆕 v4.0.0: 닫힌 탭까지 예약 자동 확인 (2026-11-09)

- **클릭 시간 기록**: URL별 마지막 자동 클릭 시각을 `chrome.storage.local`에 기록하고 `마지막 클릭 + 확인 주기`를 다음 예약 시각으로 사용합니다. 기존 v3 클릭 기록도 이어서 사용합니다.
- **기본 5시간**: 새 URL은 5시간으로 시작하며 목록에서 각 URL을 **1~48시간**으로 따로 수정할 수 있습니다. 새 주소는 등록 후 첫 확인을 바로 시작합니다.
- **자동 열기/닫기**: 예약 시각에 탭이 없으면 **비활성 탭을 자동 생성**, 버튼 상태를 확인하고 약 2분 후 자동 생성된 탭만 닫습니다. 사용자가 선택한 탭은 자동으로 닫지 않습니다.
- **재시도**: 확인 시 버튼이 보이지 않거나 준비되지 않았거나 연결 오류가 있으면 **5분 후 다시 확인**합니다. 클릭에 성공하면 예약을 그 시점 기준으로 다시 5시간(또는 설정 시간) 뒤로 미룹니다.
- **연속 클릭**: 새로운 `계속`/`Continue` 버튼이 나타나면 같은 방문 중 이어서 클릭합니다. 동일 버튼을 그대로 두 번 클릭하지 않으며 10분당 30회 초과 시 보호 제한이 작동합니다.
- **복구**: `chrome.alarms`를 이용해 서비스 워커 재시작 후에도 저장된 예약 시각을 복구하고, 탭이 브라우저에 의해 폐기되면 확인 시 다시 로드합니다.
- **제한**: Chrome이 완전히 종료되거나 PC가 절전 중일 때는 실행할 수 없습니다. 사이트의 로그인 만료, 인증/CAPTCHA, DOM 구조 변경, 서버 측 제한은 우회하지 않습니다. Chrome 알람은 지정 시각보다 늦게 실행될 수 있습니다.

**기존 설치에서 업데이트할 때:** 기존에 설치했던 폴더의 파일을 백업한 후 동일한 경로에 새 ZIP의 확장프로그램 파일을 덮어쓰고, `chrome://extensions/`에서 기존 확장의 **새로고침**을 누르세요. *새 폴더에 별도 설치하면 기존 등록 URL·클릭 기록은 자동으로 이전되지 않습니다.*

---

## 📸 Preview

<div align="center"><img src="docs/assets/popup-preview.png" alt="URL 등록, 개별 ON/OFF, 삭제, 클릭 상태가 보이는 확장프로그램 팝업" width="375"></div>

> 예시 이미지는 개인 대화 내용이 없는 설명용 데이터입니다. 이 프로젝트는 ChatGPT·Claude 등 외부 서비스와 무관한 독립 도구입니다.

## ✨ Features

| 기능 | 동작 |
|---|---|
| **URL 목록** | 최대 **50개**의 웹페이지 주소 등록·삭제. 동일한 `origin + pathname` 중복 등록 방지 |
| **버튼 문구 지정** | URL별로 `계속`, `Continue` 등 텍스트 설정 |
| **개별/전체 ON·OFF** | 한 주소만 중단하거나 전체 감시 중지 가능 |
| **닫힌 탭 자동 열기** | 예약 확인 시 해당 URL의 탭이 없으면 **비활성 탭을 생성**하고 약 2분 후 자동 닫기 |
| **URL별 예약 확인** | 기본 **5시간**(각 URL마다 1~48시간 변경 가능). 클릭 직후 다음 시각 다시 계산, 버튼이 없거나 확인 실패면 **5분 재시도** |
| **백그라운드 감시** | `chrome.alarms` 알람으로 매분 예약 시각 확인; 기존 탭은 화면 변화도 감시 |
| **조건부 클릭** | Chrome의 `disabled`, `aria-disabled`, `data-disabled`, `pointer-events` 및 DOM 변경 확인 |
| **연속 클릭 + 중복 방지** | 새로운 `계속` 버튼이 나타나면 차례로 클릭하고, 동일 버튼은 다시 누르지 않음(비활성화→활성화되면 재허용). 10분당 30회 안전 제한 |
| **상태 및 통계** | URL별 마지막 클릭, 누적 횟수, 최근 확인 시각, 다음 예약 시각, 수동 즉시 확인 |
| **로컬 저장** | URL과 설정·클릭 통계를 `chrome.storage.local`에 저장. 전송용 백엔드 없음 |

## 🚀 Windows CMD로 GitHub에 올리기

저장소 생성, 소스 업로드, **About (Description / Website / Topics)**, GitHub Pages 워크플로 설정을 자동화했습니다. **Windows의 `publish.cmd`를 두 번 클릭**하거나 CMD에서 원하는 저장소 이름을 지정하세요.

### 준비물 (최초 1회)

1. [Git for Windows](https://git-scm.com/downloads/win)와 [GitHub CLI (`gh`)](https://cli.github.com/)를 설치합니다. 설치 후 **CMD를 다시 실행**합니다.
2. GitHub 계정을 준비합니다. 로그인되어 있지 않으면 스크립트가 **브라우저 로그인**을 시작합니다. 개인 액세스 토큰(PAT)을 코드에 입력할 필요가 없습니다.
3. Git 사용자 이름과 이메일이 설정되어 있지 않다면 CMD에서 한 번만 입력합니다. (예시를 실제 본인 값으로 변경)

```bat
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

GitHub에 이메일을 공개하고 싶지 않다면 [GitHub의 비공개 이메일 주소](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)를 사용하세요.

### CMD에서 한 번에 배포

`target-tab-auto-clicker` 폴더에서 CMD를 열고 다음 중 하나를 실행합니다.

```bat
:: 기본 저장소 이름 = target-tab-auto-clicker (공개)
publish.cmd

:: 원하는 이름으로 공개 저장소 생성 또는 기존 저장소 업데이트
publish.cmd my-auto-clicker

:: 특정 사용자/조직의 저장소
publish.cmd GITHUB_USERNAME/my-auto-clicker

:: 비공개 저장소로 생성하고 싶다면 (Pages 이용 요금제 제한 확인)
publish.cmd my-private-tool private
```

명령을 입력하는 대신 `publish.cmd` 파일을 **더블클릭**해도 기본 이름으로 진행됩니다.

스크립트는 다음을 순서대로 수행합니다.

1. Git 및 GitHub CLI 확인, 필요하면 브라우저로 GitHub 로그인
2. 업로드할 `OWNER/REPOSITORY`와 공개 범위, **Git에 추가될 파일 목록을 보여주고 최종 확인 `[y/N]` 요청**
3. 프로젝트 폴더의 Git 초기화, 변경 파일 커밋 (기존 커밋은 유지)
4. 저장소가 없으면 생성, 있으면 현재 저장소에 `main` 브랜치로 일반 `git push`
5. **About 설명, Website, Topics 자동 설정** (원본: [`scripts/repository-about.json`](scripts/repository-about.json))
6. GitHub Pages를 **GitHub Actions** 방식으로 설정 시도
7. GitHub 저장소 주소, 배포 사이트 주소, Actions 확인 링크 출력

**중요:** `git push --force`를 사용하지 않습니다. 다른 저장소를 가리키는 `origin`이 있거나 원격에 다른 이력이 있으면 안전하게 중단합니다. GitHub 저장소를 자동으로 **공개** 생성하므로 공개 범위와 개인 정보가 없는 파일인지 확인한 뒤 `y`를 누르세요. 기존 저장소가 있다면 공개/비공개 상태를 변경하지 않습니다.

### ⚠️ `This folder belongs to a different Git repository` 오류 해결

Windows 사용자 폴더 자체(예: `C:\Users\<사용자명>`)가 Git 저장소로 초기화된 경우, 그 아래 `Downloads`, `Desktop`의 프로젝트에서 `git rev-parse --show-toplevel`을 실행하면 사용자 폴더를 가리킬 수 있습니다. **상위 폴더의 `.git`을 삭제하지 마세요.**

- **가장 간단한 해결책:** 프로젝트 폴더를 `C:\Projects\target-tab-auto-clicker\`처럼 상위 Git 저장소 *밖*으로 옮긴 뒤 `publish.cmd`를 실행합니다. `C:\Projects` 폴더는 필요하면 직접 생성하세요.
- **개선된 `publish.cmd` (2026-10-28 수정):** 현재 프로젝트에 `.git`이 없고 상위 저장소가 프로젝트 파일을 **추적하지 않는 경우**, 프로젝트 폴더에 별도의 `.git`을 안전하게 생성합니다. 그래서 기존 위치에서도 계속 진행할 수 있습니다. 상위 저장소의 파일은 스테이징하거나 업로드하지 않습니다.
- **상위 저장소가 프로젝트 파일을 이미 추적한다면:** 자동 초기화를 거부합니다. 이 경우 프로젝트를 상위 저장소 밖으로 옮겨 실행하세요. 상위 저장소를 초기화하거나 `git push --force`를 사용하지 마세요.

GitHub 사용자 이름이 `YOUR_USERNAME`, 저장소가 `target-tab-auto-clicker`라면 다음 명령으로 실행합니다. 본인의 GitHub 계정으로 로그인한 경우에는 그냥 `publish.cmd`만 입력해도 됩니다.

```bat
publish.cmd YOUR_USERNAME/target-tab-auto-clicker
```

정상 진행 시 업로드 파일 목록을 보여주고 공개 업로드 여부를 `[y/N]`으로 다시 묻습니다. `y`를 입력한 경우에만 커밋 및 업로드를 시도합니다. 이미 GitHub에 다른 이력이 있는 저장소라면 강제 덮어쓰지 않고 일반 `git push` 결과를 따릅니다.


**배포 후 확인**

- 저장소: `https://github.com/GITHUB_USERNAME/REPOSITORY_NAME`
- 설치 사이트: `https://GITHUB_USERNAME.github.io/REPOSITORY_NAME/`
- GitHub Actions: 저장소 **Actions → Build and deploy GitHub Pages**
- **Repository Social Preview**: 별도 수동 등록 → [ABOUT.md](ABOUT.md)

첫 실행 시 Pages API 권한이 부족할 수 있습니다. 이런 경우 저장소의 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 수동 설정한 후 Actions에서 재실행하세요. 배포가 완료될 때까지 사이트 주소가 곧바로 열리지 않을 수 있습니다.

**이후 업데이트**는 같은 폴더에서 `publish.cmd`만 다시 실행하면 변경 내용만 커밋 후 업로드합니다. GitHub Actions는 `main` 브랜치에 push 될 때마다 설치 ZIP과 웹사이트를 다시 빌드합니다.

---

## 📦 설치 방법

### 1. 설치 파일 준비

**방법 A — GitHub Pages에서 다운로드 (권장)**

공유받은 프로젝트의 GitHub Pages 사이트에서 **확장프로그램 ZIP 다운로드** 버튼을 클릭하고 압축을 풉니다. 설치용 ZIP은 Pages 배포 시 자동 생성됩니다.

**방법 B — GitHub 소스에서 설치**

GitHub 저장소에서 **Code → Download ZIP**을 클릭하고 압축을 풉니다. 저장소 폴더 최상위에 `manifest.json`이 있습니다.

### 2. Chrome 확장프로그램 설치

1. Chrome 주소창에 `chrome://extensions/` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `manifest.json`이 들어 있는 폴더 선택
5. Chrome 도구 모음의 퍼즐 아이콘에서 **대상 탭 자동 클릭**을 고정하면 편리합니다.

**주의:** ZIP 자체가 아니라 압축을 해제한 **폴더**를 선택합니다. 설치 후 그 폴더를 이동·삭제하면 확장프로그램 업데이트 및 로드에 문제가 발생할 수 있습니다.

## 🧭 사용 방법

1. 감시하려는 ChatGPT/Claude 등의 **정확한 대화 URL**을 브라우저에서 복사합니다.
2. 확장프로그램 팝업의 **감시할 페이지 URL** 입력창에 붙여넣습니다. **현재 탭 주소 가져오기**도 사용할 수 있습니다.
3. **클릭할 버튼 문구**에 실제 표시되는 버튼 텍스트를 입력합니다. 예: `계속`, `Continue`.
4. 확인 주기를 선택합니다(기본 5시간). **+ 목록에 추가** 클릭 후 Chrome의 해당 도메인 접근 권한 요청을 허용합니다.
5. 다른 페이지도 같은 방법으로 추가합니다. 목록에서 각 항목의 **주기 조정**, **지금 확인**, **탭 열기/탭 이동**, **스위치**, **삭제**를 사용할 수 있습니다.
6. 전체 감시를 중지하고 싶을 때는 맨 위 **전체 자동 클릭**을 끕니다.

### URL 처리 예시

| 등록한 URL | 일치 여부 |
|---|---|
| `https://example.com/chat/abc` | `https://example.com/chat/abc?view=1` ✅ |
| `https://example.com/chat/abc/` | `https://example.com/chat/abc` ✅ |
| `https://example.com/chat/other` | `https://example.com/chat/abc` ❌ |

쿼리스트링(`?`), 해시(`#`), 마지막 슬래시(`/`)는 비교에서 제외하고, 경로가 다른 URL은 별개의 페이지로 취급합니다. 단, 쿼리스트링에 따라 **서로 다른 페이지 내용**을 표시하는 사이트에는 이 비교 규칙이 적합하지 않을 수 있습니다.

### 클릭 동작 방식

- **ChatGPT** (`chatgpt.com`, `chat.openai.com`): 사용량 제한 안내 영역의 지정한 문구와 일치하는 버튼을 클릭합니다.
- **그 외 등록된 사이트**: 지정 버튼이 페이지를 열자마자 활성화되어 있어도 클릭할 수 있습니다. **신뢰할 수 있는 정확한 URL만 등록**해야 합니다.
- 화면 갱신은 `MutationObserver`와 보조 폴링(약 1.8초)으로 처리합니다. 완전한 실시간 동작을 보장하지 않습니다.
- 서비스의 이용 제한을 우회하거나 사용량을 늘리지 않습니다. 외부 사이트 DOM 구조가 변경되면 동작하지 않을 수 있습니다.

## 🛠 문제 해결

| 현상 | 조치 |
|---|---|
| 대상 탭 없음 | 자동으로 다음 예약 시각에 탭을 엽니다. 즉시 확인하려면 해당 항목의 **지금 확인**을 누르세요. |
| 버튼이 눌리지 않음 | 버튼 문구와 사이트 접근 권한을 확인합니다. 대상 버튼이 비활성→활성으로 전환되었는지도 확인합니다. |
| 백그라운드에서 지연 | Chrome이 열린 상태라면 알람 시각에 폐기된 탭도 다시 로드합니다. PC가 절전 상태이거나 Chrome이 완전히 종료되면 실시간 확인할 수 없고 재개 후 확인합니다. |
| 로그인 화면에서 작동하지 않음 | 로그인 후 **대상 대화 URL**을 열어야 합니다. 로그인·보안 화면을 우회하지 않습니다. |
| 중복 클릭 | v1/v2 확장프로그램과 v3가 동시에 실행 중인지 확인하고 이전 버전은 끕니다. |
| 설치 오류 | 압축을 해제했는지, `manifest.json`이 선택한 폴더 안에 있는지 확인합니다. |
| 업그레이드 후 설정 사라짐 | 새 확장으로 설치하면 저장소가 다릅니다. 기존 설치를 유지한 채 파일을 교체해야 자동 이전이 가능합니다. |

### v2 → v3 업데이트

기존 v2 **설치 경로를 유지한 상태에서** 해당 폴더의 파일을 v3 파일로 덮어쓰고 `chrome://extensions/`에서 **새로고침**하면, v2의 단일 URL 설정이 v3의 목록에 이전되도록 구현했습니다. **별도 새 확장으로 설치한 경우에는 이전되지 않습니다.** 먼저 기존 URL과 설정을 별도로 기록해 두는 편이 안전합니다.

## 🔐 개인정보 및 권한

- `storage`: URL 목록, ON/OFF, 탭 연결 상태, 클릭 횟수 저장
- `tabs`, `webNavigation`: 대상 URL과 일치하는 탭 찾기·재연결
- `scripting`: 사용자 승인 사이트에서 감시 스크립트 주입
- `optional_host_permissions` (`http`, `https`): URL 등록 시 **해당 사이트만 사용자가 개별 승인**. 해당 사이트의 마지막 URL 삭제 시 권한 해제 시도

**개인 대화 내용이나 사이트 비밀번호를 수집·외부 전송하도록 작성하지 않았습니다.** 단, 확장프로그램은 사용자가 승인한 페이지의 DOM에 접근할 수 있으므로, 설치 전 코드를 검토하고 신뢰할 수 있는 출처에서 받으세요. 개인 대화의 실제 URL, 브라우저 프로필, 인증 토큰 등을 공개 GitHub 저장소에 커밋하지 마세요.

## 🧱 Tech Stack

- Chrome **Manifest V3** · JavaScript ES2022 · HTML5 · CSS3
- Chrome Extension APIs: `chrome.tabs`, `chrome.scripting`, `chrome.storage.local`, `chrome.permissions`, `chrome.webNavigation`
- 랜딩 페이지: 정적 HTML/CSS, **Python 표준 라이브러리 빌드** (Node 패키지 설치 불필요)
- 자동 배포: GitHub Actions → GitHub Pages
- 테스트: Node.js 내장 `assert` + Python Playwright (브라우저 테스트는 선택 사항)

## 📁 Project Structure

```text
.
├── publish.cmd                   Windows CMD 원클릭 GitHub 배포
├── scripts/publish.ps1           Git/gh 자동화 및 About 설정
├── scripts/repository-about.json About 메타데이터
├── ABOUT.md                      저장소 소개 및 Social Preview 안내
├── manifest.json                 Chrome 확장프로그램 매니페스트
├── background.js                 URL별 대상 탭 및 클릭 권한 처리
├── content.js                    활성화 감시·조건부 클릭
├── popup.html / popup.css / popup.js
├── icons/                       확장프로그램 아이콘
├── docs/                        GitHub Pages 소개·설치 사이트 원본
│   ├── index.html / styles.css / 404.html
│   ├── assets/popup-preview.png
│   └── og-image.png / repository-social-preview.png
├── scripts/build_site.py         정적 페이지 및 설치용 ZIP 생성
├── tests/                       단위·UI·DOM 테스트
├── .github/workflows/pages.yml   GitHub Pages 자동 배포
├── LICENSE
└── README.md
```

## 💻 Local Development

확장프로그램 실행 자체에는 **npm 설치나 별도 서버가 필요하지 않습니다.** `manifest.json`이 있는 폴더를 Chrome에서 직접 로드하면 됩니다.

문법·단위 테스트:

```bash
node --check background.js
node --check content.js
node --check popup.js
node tests/background_test.cjs
```

브라우저 UI 테스트(선택 사항):

```bash
python -m pip install playwright
python -m playwright install chromium
python tests/popup_test.py
python tests/browser_test_v3.py
```

테스트는 로컬 시뮬레이션을 사용하며 실제 ChatGPT·Claude 계정에 접속하지 않습니다.

## 🔧 Build

Python 3.10+이면 설치용 ZIP과 배포 가능한 GitHub Pages 사이트를 함께 만들 수 있습니다.

```bash
python scripts/build_site.py --repository USERNAME/REPOSITORY
python -m http.server 8000 --directory dist/site
```

브라우저에서 `http://localhost:8000/`을 열면 다운로드 버튼까지 작동합니다. 결과:

- `dist/site/`: GitHub Pages 업로드 대상 사이트 (다운로드 ZIP 포함)
- `dist/site/downloads/target-tab-auto-clicker-v4.0.0.zip`: 사이트 방문자용 설치 ZIP
- `dist/target-tab-auto-clicker-v4.0.0.zip`: GitHub Release에 첨부할 설치 ZIP

패키지에는 확장프로그램 필수 실행 파일과 아이콘·README·LICENSE만 포함됩니다. 비밀번호·토큰·비공개 설정 파일은 포함되지 않습니다.

## 🚀 GitHub Pages 배포

### 1. GitHub 저장소 만들기

**Windows CMD 사용자는 위 [Windows CMD로 GitHub에 올리기](#-windows-cmd로-github에-올리기)를 권장합니다.** 아래 수동 방법은 다른 운영체제나 Git 숙련자를 위한 대안입니다.

1. GitHub 로그인 → **New repository**
2. 예: `target-tab-auto-clicker`라는 **Public** 저장소 생성
3. 이 프로젝트 폴더의 **내부 파일과 숨김 `.github` 폴더를 모두** 저장소 루트에 업로드 (또는 Git으로 push)
4. 기본 브랜치를 `main`으로 사용

Git CLI를 사용한다면:

```bash
git init
git add .
git commit -m "Publish Target Tab Auto Clicker v4.0"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

`USERNAME/REPOSITORY`는 본인의 실제 저장소 주소로 변경합니다. **업로드 전 `.github/workflows/pages.yml` 파일이 포함되어 있는지 확인**하세요.

### 2. Pages 자동 배포 설정

1. 저장소 **Settings → Pages** 이동
2. **Build and deployment → Source → GitHub Actions** 선택
3. 저장소 **Actions**에서 `Build and deploy GitHub Pages` 워크플로 성공 여부 확인
4. 배포된 사이트 주소 접속:

   `https://USERNAME.github.io/REPOSITORY/`

`main`으로 `git push`할 때마다 **JS 문법/단위 검사 → 정적 사이트 및 설치 ZIP 생성 → Pages 배포**가 실행됩니다. 저장소 경로가 달라도 상대 링크가 깨지지 않도록 처리하고, 실제 저장소 이름을 활용해 OG URL과 canonical 링크를 빌드 시 생성합니다.

### 3. GitHub Repository 소개 설정

저장소 우측 **About → Edit**에서 설명과 Website에 Pages URL을 넣습니다. Topic 예시: `chrome-extension`, `manifest-v3`, `automation`, `tab-manager`, `javascript`, `open-source`.

GitHub **Settings → General → Social preview**에서 `docs/repository-social-preview.png`를 지정하면 공유 카드가 표시됩니다. 자세한 소개 문구 및 수동 입력 방법은 [ABOUT.md](ABOUT.md)를 확인하세요. `publish.cmd`를 사용하면 Description / Website / Topics는 자동 설정됩니다.

### 4. GitHub Releases (선택)

`Releases → Draft a new release`에서 태그 `v4.0.0`을 만들고 `dist/target-tab-auto-clicker-v4.0.0.zip`을 업로드하면 버전별 설치 파일을 기록할 수 있습니다. 다만 Pages 소개 사이트에서도 ZIP을 바로 다운로드할 수 있으므로 Release 업로드가 필수는 아닙니다.

## 🏷 GitHub About 소개

**Description:** 여러 URL의 탭에서 '계속/Continue' 버튼이 활성화되면 자동 클릭하는 Chrome 확장프로그램 | URL별 ON/OFF · 로컬 저장

**Topics:** `chrome-extension` · `manifest-v3` · `browser-automation` · `auto-clicker` · `tab-manager` · `javascript` · `github-pages` · `open-source`

설명과 Topics는 [`scripts/repository-about.json`](scripts/repository-about.json)에서 수정할 수 있으며, [ABOUT.md](ABOUT.md)에 복사해 쓸 수 있는 내용과 Social Preview 설정법을 정리했습니다.

## ⚙️ Configuration

- 확장 버전·이름·권한: `manifest.json`
- 탭 관리 및 대상 최대 개수(`MAX_TARGETS = 50`): `background.js` / `popup.js`의 등록 조건
- 버튼 상태 및 매칭: `content.js`
- 팝업 디자인: `popup.css`
- 랜딩 페이지: `docs/index.html`, `docs/styles.css`
- 배포 주소/OG 태그/다운로드 ZIP: `scripts/build_site.py`

저장소 기본 주소 대신 자체 도메인을 사용하려면 로컬 빌드 시 `--base-url https://your-domain.example/`을 지정할 수 있습니다. GitHub Actions에서도 저장소 설정의 **Variables**에 `PAGES_BASE_URL`을 지정하면 빌드가 이를 사용하도록 만들어져 있습니다. GitHub의 **Settings → Pages → Custom domain**과 DNS 설정도 별도로 필요하며 HTTPS가 활성화됐는지 확인하세요. 이 프로젝트에는 존재하지 않는 도메인의 `CNAME`을 미리 포함하지 않았습니다.

## 🤝 Contributing / Issue

버그 리포트를 남길 때는 **실제 대화 URL이나 개인 데이터 없이** Chrome 버전, 확장프로그램 버전, 재현 순서, 버튼의 속성(`disabled`, `aria-disabled` 등)을 알려주세요. 서비스 UI 변경으로 인한 감지 오류가 발생할 수 있습니다.

## 📜 License / Disclaimer

[MIT License](LICENSE) · © 2026 Continue Auto Clicker Contributors

이 프로젝트는 Chrome 웹 스토어 배포나 제3자 서비스의 공식 지원을 의미하지 않습니다. 사용하려는 웹사이트의 이용약관·자동화 관련 규칙을 준수하세요. Chrome/PC가 종료되거나 탭이 폐기된 동안은 감시하지 못합니다.
