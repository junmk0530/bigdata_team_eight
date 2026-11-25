# 갈린 보도

지금 들어오는 기사 중에서, 같은 사건인데 숫자나 말이 다른 것만 보여 준다. 어느 쪽이 사실인지는 정하지 않는다. 검색어로 기사 목록을 찾는 화면이 아니다.

## 설계

1. 여러 매체 RSS에서 최신 제목과 본문 앞부분을 모은다.
2. 명사 집합에 MinHash와 LSH를 적용해 같은 사건으로 묶는다. 기준 Jaccard는 0.22다.
3. 한 묶음 안에서 두 갈래만 남긴다. 사망자나 금액처럼 같은 대상의 숫자가 다르면 남긴다. `9천440억`과 `9440억`은 같은 값이다. 제목의 결론이 다르면 남긴다. 예를 들면 폐쇄와 검토, 상승과 하락이다. `동의 못 해`는 거부와 같은 결론으로 본다. 두 기사에 공통된 고유 명사가 없으면 버린다. 같은 매체의 수정은 갈림으로 보지 않는다.
4. 비교 글은 그 문장만 사용한다. `galrim/.env`의 `ZAI_API_KEY`와 `ZAI_MODEL`이 있으면 모델이 쓰고, 인용과 숫자가 기사에 있는지 확인한다. 없거나 검증에 실패하면 매체와 원문 문장만 이어 붙인다. 이 파일은 저장소에 올리지 않는다.
5. 갈림이 없는 사건은 화면에 나오지 않는다.

미리 넣어 둔 옛날 기사 파일은 서비스 데이터가 아니다. 묶음과 갈림 규칙은 테스트로 확인한다.

## 실행

Python 3.11과 kiwipiepy가 필요하다. 같은 수업 폴더의 `issue-jongmok\.venv`를 써도 된다.

```powershell
..\issue-jongmok\.venv\Scripts\python.exe -m unittest tests.test_diverge
..\issue-jongmok\.venv\Scripts\python.exe -m galrim refresh
..\issue-jongmok\.venv\Scripts\python.exe -m galrim serve
```

화면은 http://127.0.0.1:8775 이다. `지금 기사 다시 받기`가 피드를 다시 읽는다.
