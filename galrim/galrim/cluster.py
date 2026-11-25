"""명사 집합에 MinHash와 LSH를 적용하고 Jaccard로 다시 거른다."""

PRIME = 4294967291
MASK = 0xFFFFFFFF
BANDS = 64
ROWS = 2


def hash32(text: str) -> int:
    value = 2166136261
    for char in text:
        value ^= ord(char)
        value = (value * 16777619) & MASK
    return value


PERMS = [(1 + hash32(f"a-{i}") % 65534, hash32(f"b-{i}")) for i in range(BANDS * ROWS)]


def signature(words: set[str]) -> list[int]:
    values = [hash32(word) for word in words]
    if not values:
        return []
    return [min((a * item + b) % PRIME for item in values) for a, b in PERMS]


def jaccard(left: set[str], right: set[str]) -> float:
    if not left and not right:
        return 0.0
    union = len(left | right)
    return len(left & right) / union if union else 0.0


def cluster(articles: list[dict], token_sets: list[set[str]], threshold: float = 0.22) -> list[dict]:
    if len(articles) != len(token_sets):
        raise ValueError("기사 수와 명사 집합 수가 다릅니다.")
    count = len(articles)
    parent = list(range(count))
    degree = [0] * count

    def root(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    buckets: dict[str, list[int]] = {}
    seen: set[int] = set()
    for index, words in enumerate(token_sets):
        if not words:
            continue
        signs = signature(words)
        for band in range(BANDS):
            key = f"{band}:{signs[band * ROWS]},{signs[band * ROWS + 1]}"
            bucket = buckets.setdefault(key, [])
            for other in bucket:
                pair = other * count + index
                if pair in seen:
                    continue
                seen.add(pair)
                if jaccard(token_sets[index], token_sets[other]) >= threshold:
                    parent[root(index)] = root(other)
                    degree[index] += 1
                    degree[other] += 1
            bucket.append(index)

    groups: dict[int, list[int]] = {}
    for index in range(count):
        groups.setdefault(root(index), []).append(index)
    built = []
    for indexes in groups.values():
        indexes.sort(key=lambda item: (-degree[item], articles[item]["title"]))
        counts: dict[str, int] = {}
        for index in indexes:
            for word in token_sets[index]:
                counts[word] = counts.get(word, 0) + 1
        keywords = [word for word, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:6]]
        members = [articles[index] for index in indexes]
        tokens = [token_sets[index] for index in indexes]
        built.append({
            "id": f"g-{hash32('|'.join(sorted(article['id'] for article in members)))}",
            "keywords": keywords,
            "articles": members,
            "tokens": tokens,
            "size": len(members),
        })
    built.sort(key=lambda group: (-group["size"], group["articles"][0]["title"]))
    return built
