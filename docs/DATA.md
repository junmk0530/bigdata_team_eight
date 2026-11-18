# 데이터와 주고받는 형식

## 데이터셋

분석에 쓰는 데이터는 UCI Machine Learning Repository의 News Aggregator다.

- 주소: https://archive.ics.uci.edu/dataset/359/news+aggregator
- 기간: 2014-03-10 ~ 2014-08-10
- 라이선스: Public domain. 기사 본문은 쓰지 않고 제목, 출처, URL, 분야, 시각만 쓴다.
- 선택한 이유: 여러 매체 제목이 같은 사건 ID(`STORY`)로 묶여 있다. 한 매체의 분류 데이터보다 이번 과제에 맞다.

원본 zip은 용량이 커서 저장소에 넣지 않는다. 아래 파일로 받는다.

`https://archive.ics.uci.edu/static/public/359/news+aggregator.zip`

받은 파일을 `work/raw/news-aggregator.zip`에 두고 `python scripts/prepare-uci-sample.py`를 실행한다. 샘플 시드는 `20261118`이다.

분야 대응은 `b` Business, `t` Tech, `e` Entertainment, `m` Health다. 원본에는 Politics, World, Sports가 없다.

샘플 규칙: 같은 `STORY`의 제목이 2개 이상인 사건만 남기고, 사건당 최대 6개 제목을 쓴다. 제목과 출처가 같은 중복은 제거한다.

| 용도 | 파일 | 규모 |
|---|---|---|
| LSH 정답 비교 | `data/uci-eval.json` | 제목 1,500개, 사건 253개 |
| 웹 첫 화면 | `public/data/headlines.json` | 제목 480개, 사건 80개 |

실험 샘플 분야는 Business 520, Entertainment 408, Tech 343, Health 229다. 웹 샘플은 Business 180, Entertainment 114, Tech 114, Health 72다. 웹 샘플은 실험 샘플의 앞부분이다.

사용자 열람 이력은 이 데이터에 없다. 관심 분야와 북마크는 서비스가 브라우저와 로그인 계정에 따로 저장한다.

## 전처리

전처리는 `lib/news-engine.ts`의 `tokens`와 같다.

1. 제목 앞뒤 공백을 제거한다. 비어 있거나 1,000자를 넘거나 토큰이 없으면 그 행은 건너뛴다.
2. NFKC로 정규화하고 소문자로 바꾼다.
3. 문자와 숫자 연속만 단어로 남긴다. 구두점과 특수문자는 구분 기호로 사라진다.
4. 불용어 `a an the and or but to of in on at for from with by as is are was were be been this that after before into over amid says said new news report reports update live`를 뺀다.
5. 남은 단어의 집합으로 Jaccard를 계산한다. 문자 단위 k-shingle은 쓰지 않는다.

## 입력 행

`parseDataset`이 CSV, JSON 배열, `{ "articles": [...] }`, JSONL을 받는다. 웹에 올리는 행은 아래 필드를 쓴다.

| 필드 | 필수 | 받아들일 이름 |
|---|---|---|
| 제목 | 예 | `title`, `headline`, `news_title` |
| 출처 | 아니오 | `source`, `publisher`, `authors` |
| 분야 | 아니오 | `category`, `topic` |
| 날짜 | 아니오 | `date`, `published_at` |
| 주소 | 아니오 | `url`, `link` |

`story`는 실험 파일에만 있다. 화면과 그룹화는 이 값을 쓰지 않는다. `http`와 `https`가 아닌 주소는 비운다. 분야 이름은 World, Politics, Business, Tech, Sports, Health로 맞추고, 나머지는 적은 이름을 그대로 둔다.

## 분석 결과

`normalizeArticles`가 만드는 기사:

- `id`, `title`, `source`, `category`, `date`, `url`

`cluster`가 만드는 그룹:

- `id`: 구성 기사 id로 만든 값. 입력 순서가 바뀌어도 같다.
- `title`: 연결 수가 가장 많은 기사의 제목
- `articles`: 기사 배열
- `category`: 구성 기사에서 가장 많은 분야
- `keywords`: 공통 단어 최대 6개
- `differences`: 같은 단위인데 숫자가 다른 제목 표현
- `threshold`, `dataset`: 이번 분석의 기준과 데이터 이름
- `databaseId`, `databaseDatasetId`: 공유 DB에 올라간 뒤에만 붙는다.

한 번에 최대 5,000개 제목, LSH 후보 최대 300,000쌍이다.
