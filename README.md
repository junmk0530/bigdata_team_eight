## Team Information

- **Team Name:** eight_team
- **Team Leader:** 이준목 (2024270681)
- **Team Members:**
  - 송정훈 (Student ID)
  - 최대환 (Student ID)
  - 이윤서 (Student ID)

## Project Title

NewsLens: Similar News Grouping and Summarization Service Based on MinHash and LSH

## Overview

As more media outlets repeatedly report the same event under slightly different headlines, readers waste time checking information they have already seen. This project applies MinHash and LSH (Locality-Sensitive Hashing) to a public news headline dataset to quickly find candidate pairs of similar articles. It then uses an Upstage Solar agent to summarize what each group of articles has in common, and delivers the results through a web service.

## Goals

1. Use MinHash and LSH to quickly find similar article pairs among a large number of news headlines, and compare processing time and accuracy (Precision/Recall) against an all-pairs comparison.
2. Group similar articles into event clusters and use Upstage Solar to summarize the common content of each group in one or two sentences.
3. Build a web service where users can easily browse similar news lists and per-group summaries.

## Description

- **Data processing:** Collect a public news headline dataset and preprocess it (special character removal, normalization). Since Korean headlines are short, shingles are built from character n-grams rather than words.
- **Candidate search:** Build a MinHash signature from each headline's shingle set and find candidate pairs with LSH banding (b, r). Vary b and r to analyze how false positives and false negatives change with the S-curve threshold (1/b)^(1/r).
- **Grouping:** Keep only candidate pairs whose actual Jaccard similarity is above a threshold, and merge connected articles into event groups using Union-Find.
- **Summarization:** Feed representative headlines from each group to an Upstage Solar agent to summarize the shared content, with a short note on what each article emphasizes differently.
- **Web service:** Consists of a backend API and a frontend. It shows event groups, per-group summaries, member articles and similarity scores, and supports keyword search.
- **Evaluation:** Using the all-pairs comparison as ground truth, measure LSH's Precision, Recall, processing time and reduction in comparisons. Summary quality is rated by team members on sample groups.

## Milestones

| Week | Tasks |
|---|---|
| Week 1 | Team formation, topic selection, role assignment |
| Week 2 | Dataset selection and collection, preprocessing, shingling design, all-pairs Jaccard ground truth |
| Week 3 | MinHash signatures and LSH banding, b·r parameter experiments, Union-Find grouping, accuracy and performance analysis |
| Week 4 | Upstage Solar integration, summarization prompt design and quality check |
| Week 5 | Web service backend and frontend, end-to-end pipeline integration |
| Week 6 | Integration testing, performance results, final report and presentation |
