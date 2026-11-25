STOP = {
    "기자", "뉴스", "속보", "종합", "사진", "영상", "단독", "오늘", "이번", "관련",
    "가능", "예정", "전망", "분석", "기사", "제목", "보도", "전하다",
}
GENERIC = STOP | {
    "사망", "부상", "실종", "확진", "감염", "대피", "이재민", "피해", "매출", "영업",
    "이익", "수주", "계약", "예산", "지원", "벌금", "징역", "화재", "침수", "한국",
    "정부", "경찰", "소방", "현장", "발생", "사고", "사건", "지역", "서울", "사람",
}

_kiwi = None


def nouns(title: str) -> set[str]:
    global _kiwi
    if _kiwi is None:
        from kiwipiepy import Kiwi
        _kiwi = Kiwi()
    found = set()
    for token in _kiwi.tokenize(title):
        if token.tag not in {"NNG", "NNP"}:
            continue
        word = token.form.strip()
        if len(word) < 2 or word in STOP:
            continue
        found.add(word)
    return found
