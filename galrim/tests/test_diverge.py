import unittest

from galrim.collect import resolve_source
from galrim.compose import accept_model, grounded_text
from galrim.diverge import divergences, mentions


def article(id, title, source, summary=""):
    return {"id": id, "title": title, "summary": summary, "source": source, "publishedAt": "", "url": ""}


class DivergeTests(unittest.TestCase):
    def test_different_death_counts_from_two_outlets(self):
        articles = [
            article("1", "서울역 화재로 사망 30명", "연합뉴스"),
            article("2", "서울역 화재로 사망 50명", "KBS"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"서울역", "화재"}, {"서울역", "화재"}]}
        found = divergences(group)
        self.assertEqual(len(found), 1)
        self.assertEqual({side["value"] for side in found[0]["sides"]}, {"30", "50"})
        self.assertIn("연합뉴스는", grounded_text(found[0]))
        self.assertIn("사망 30명", grounded_text(found[0]))

    def test_same_number_is_not_listed(self):
        articles = [
            article("1", "서울역 화재로 사망 30명", "연합뉴스"),
            article("2", "서울역 화재 사망 30명", "KBS"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"서울역"}, {"서울역"}]}
        self.assertEqual(divergences(group), [])

    def test_same_outlet_is_not_a_split(self):
        articles = [
            article("1", "서울역 화재로 사망 30명", "연합뉴스"),
            article("2", "서울역 화재로 사망 50명", "연합뉴스"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"서울역"}, {"서울역"}]}
        self.assertEqual(divergences(group), [])

    def test_unrelated_accidents_are_dropped(self):
        articles = [
            article("1", "부산 침수로 사망 4명", "연합뉴스"),
            article("2", "대구 화재로 사망 9명", "KBS"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"부산", "침수"}, {"대구", "화재"}]}
        self.assertEqual(divergences(group), [])

    def test_model_text_cannot_add_a_number(self):
        articles = [article("1", "서울역 화재로 사망 30명", "연합뉴스"), article("2", "서울역 화재로 사망 50명", "KBS")]
        rejected = accept_model({
            "text": "실제 사망자는 999명이다.",
            "quotes": [{"source": "연합뉴스", "sentence": "서울역 화재로 사망 30명"}],
        }, articles)
        self.assertIsNone(rejected)
        accepted = accept_model({
            "text": "연합뉴스는 사망 30명, KBS는 사망 50명으로 썼다.",
            "quotes": [
                {"source": "연합뉴스", "sentence": "서울역 화재로 사망 30명"},
                {"source": "KBS", "sentence": "서울역 화재로 사망 50명"},
            ],
        }, articles)
        self.assertEqual(accepted["model"], "zai")

    def test_korean_money_with_the_same_value_is_not_a_split(self):
        articles = [
            article("1", "노소영 위자료 9천440억원 지급", "연합뉴스"),
            article("2", "노소영 위자료 9440억원 지급", "KBS"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"노소영", "위자료"}, {"노소영", "위자료"}]}
        self.assertEqual(divergences(group), [])

    def test_different_korean_money_is_a_split(self):
        articles = [
            article("1", "노소영 위자료 9천440억원 지급", "연합뉴스"),
            article("2", "노소영 위자료 8천억원 지급", "KBS"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"노소영"}, {"노소영"}]}
        found = divergences(group)
        self.assertEqual(len(found), 1)
        self.assertEqual({side["value"] + side["unit"] for side in found[0]["sides"]}, {"9440억원", "8000억원"})

    def test_closed_versus_under_review(self):
        articles = [
            article("1", "북한, 평양 주재 스위스 외교사무소 전격폐쇄", "연합뉴스"),
            article("2", "김여정, 스위스 제재에 평양 외교사무소 철수 검토", "경향신문"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"스위스", "사무소"}, {"스위스", "사무소"}]}
        found = divergences(group)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["topic"], "사무소")
        self.assertEqual({side["value"] for side in found[0]["sides"]}, {"폐쇄", "검토"})

    def test_status_words_about_different_targets_are_dropped(self):
        articles = [
            article("1", "여당, 조희대 탄핵 연대를 서두르고 혁신당은 일정 확정만 압박", "연합뉴스"),
            article("2", "김민석, 조희대 탄핵 신속 추진을 위한 야당 연대 제안", "경향신문"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"탄핵", "연대"}, {"탄핵", "연대"}]}
        self.assertEqual(divergences(group), [])

    def test_refusing_agreement_is_the_same_claim(self):
        articles = [
            article("1", "노소영, 최태원 화해 요청에 동의 못 해", "연합뉴스"),
            article("2", "노소영 측, 최태원 화해 요청 거부", "MBC"),
        ]
        group = {"size": 2, "articles": articles, "tokens": [{"노소영", "최태원"}, {"노소영", "최태원"}]}
        self.assertEqual(divergences(group), [])

    def test_age_is_not_a_count(self):
        self.assertEqual(mentions(article("1", "사찰 석탑을 무너뜨린 60대 징역 2년", "연합뉴스")), [])

    def test_yonhap_feed_keeps_its_outlet(self):
        title, source = resolve_source("북한 관련 속보", "(서울=연합뉴스) 기자 설명", "", "https://www.yna.co.kr/rss/news.xml")
        self.assertEqual(source, "연합뉴스")
        self.assertEqual(title, "북한 관련 속보")


if __name__ == "__main__":
    unittest.main()
