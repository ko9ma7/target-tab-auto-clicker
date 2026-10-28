# Contributing

기능 제안, 버그 제보, 문서 개선, 테스트 보강을 환영합니다.

1. Issue에서 기존 보고와 중복되는지 확인합니다.
2. **개인정보가 포함된 URL, 대화 본문, 인증 토큰, 브라우저 프로필 데이터는 업로드하지 않습니다.** 테스트에는 예시 도메인 또는 가짜 대화 ID만 사용합니다.
3. PR 전 다음 기본 검증을 실행합니다.

```bash
node --check background.js
node --check content.js
node --check popup.js
node tests/background_test.cjs
python scripts/build_site.py --repository example/example
python tests/site_build_test.py
```

4. Chrome Extension의 권한이 달라지는 변경 사항이라면, 변경 이유와 위험을 명확히 기록합니다.
5. 사용자에게 보이는 변경은 `README.md`, 설치 안내 사이트(`docs/`), `CHANGELOG.md`를 함께 갱신합니다.

실제 서비스의 UI는 수시로 바뀌므로, 브라우저 테스트 결과를 근거 없이 보장하지 않습니다.
