//! Picks a helpful YouTube tutorial for a skill.
//!
//! YouTube stopped returning dislike counts in 2021, so "helpful" is judged from
//! what the API still gives us:
//!   - reach: views, on a log scale so a 10M-view video doesn't bury a 200k one
//!   - approval: likes per view, shrunk toward a typical rate so a tiny video
//!     with 5 likes out of 40 views can't win on a lucky ratio
//!   - comments: a sample of the most relevant comments, scored for "this
//!     helped / it finally clicked" versus "this hurt / didn't work". Pain and
//!     voice-loss complaints matter a lot for vocal technique.
//!
//! Shorts, very long streams and tiny videos are filtered out first.

use serde::{Deserialize, Serialize};
use serde_json::Value;

const API: &str = "https://www.googleapis.com/youtube/v3";
const SEARCH_RESULTS: u32 = 15;
/// Candidates whose comments get sampled (1 quota unit each).
const COMMENT_SAMPLED: usize = 5;
const COMMENTS_PER_VIDEO: u32 = 50;
const MIN_SECONDS: u64 = 120;
const MAX_SECONDS: u64 = 60 * 60;
const MIN_VIEWS: u64 = 1_000;
/// Roughly what a well-liked tutorial gets; used as the prior and the "1.0x" mark.
const TYPICAL_LIKE_RATE: f64 = 0.03;
const LIKE_PRIOR_VIEWS: f64 = 2_000.0;
/// How many picks to keep: the winner plus a couple of alternatives.
pub const KEEP: usize = 3;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TutorialVideo {
    pub video_id: String,
    pub title: String,
    pub channel: String,
    pub thumbnail_url: String,
    pub duration_seconds: u64,
    pub views: u64,
    /// None when the uploader hides likes.
    pub likes: Option<u64>,
    pub comments_sampled: u32,
    pub positive_comments: u32,
    pub negative_comments: u32,
    pub score: f64,
}

// --- Scoring -------------------------------------------------------------------

/// Phrases that mean the negative words below are being denied ("didn't hurt").
const NEGATED: &[&str] = &[
    "doesn't hurt", "doesnt hurt", "didn't hurt", "didnt hurt", "don't hurt", "dont hurt",
    "not hurt", "no pain", "without pain", "pain free", "pain-free", "painless",
    "without hurting", "no strain", "without strain", "not sore",
];

const POSITIVE: &[&str] = &[
    "thank", "helped", "helpful", "finally", "it worked", "works", "worked for me", "clicked",
    "clear", "best tutorial", "best video", "life saver", "lifesaver", "learned", "great explanation",
    "so useful", "game changer", "got it", "easy to follow", "well explained", "denied-complaint",
];

const NEGATIVE: &[&str] = &[
    "hurt", "pain", "sore", "lost my voice", "damage", "blood", "bleed", "didn't work", "didnt work",
    "doesn't work", "doesnt work", "not working", "useless", "clickbait", "confusing", "waste of time",
    "bad advice", "dangerous", "strain", "raw throat", "coughing",
];

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct Sentiment {
    pub sampled: u32,
    pub positive: u32,
    pub negative: u32,
    /// Like-weighted totals, so a comment 900 people agreed with counts for more.
    pub positive_weight: f64,
    pub negative_weight: f64,
}

/// Classifies one comment: Some(true) helpful, Some(false) a complaint, None neutral.
/// A complaint wins over praise ("thanks, but now my throat hurts").
pub fn classify_comment(text: &str) -> Option<bool> {
    let mut t = text.to_lowercase().replace('’', "'");
    for phrase in NEGATED {
        t = t.replace(phrase, " denied-complaint ");
    }
    if NEGATIVE.iter().any(|w| t.contains(w)) {
        Some(false)
    } else if POSITIVE.iter().any(|w| t.contains(w)) {
        Some(true)
    } else {
        None
    }
}

pub fn comment_sentiment(comments: &[(String, u64)]) -> Sentiment {
    let mut s = Sentiment { sampled: comments.len() as u32, ..Default::default() };
    for (text, likes) in comments {
        let weight = 1.0 + (1.0 + *likes as f64).ln();
        match classify_comment(text) {
            Some(true) => {
                s.positive += 1;
                s.positive_weight += weight;
            }
            Some(false) => {
                s.negative += 1;
                s.negative_weight += weight;
            }
            None => {}
        }
    }
    s
}

/// Views and like rate only; used to decide whose comments are worth sampling.
pub fn base_score(views: u64, likes: Option<u64>) -> f64 {
    let reach = (views as f64 + 1.0).log10();
    let approval = match likes {
        Some(likes) => {
            let rate = (likes as f64 + TYPICAL_LIKE_RATE * LIKE_PRIOR_VIEWS)
                / (views as f64 + LIKE_PRIOR_VIEWS);
            (rate / TYPICAL_LIKE_RATE).clamp(0.25, 2.0)
        }
        None => 1.0,
    };
    reach * approval
}

/// 0.5x for comments that are all complaints up to 1.5x for all praise; 1.0x with
/// nothing to go on. Two pseudo-comments each way keep a single comment from
/// swinging it.
pub fn sentiment_factor(s: &Sentiment) -> f64 {
    let positivity = (s.positive_weight + 2.0) / (s.positive_weight + s.negative_weight + 4.0);
    0.5 + positivity
}

pub fn eligible(duration_seconds: u64, views: u64) -> bool {
    (MIN_SECONDS..=MAX_SECONDS).contains(&duration_seconds) && views >= MIN_VIEWS
}

/// Parses YouTube's ISO 8601 durations ("PT1H2M3S", "P1DT2H").
pub fn parse_duration(iso: &str) -> Option<u64> {
    let rest = iso.strip_prefix('P')?;
    let mut total = 0u64;
    let mut num = String::new();
    let mut in_time = false;
    for c in rest.chars() {
        match c {
            'T' => in_time = true,
            '0'..='9' => num.push(c),
            unit => {
                let n: u64 = num.parse().ok()?;
                num.clear();
                total += n * match (unit, in_time) {
                    ('D', false) => 86_400,
                    ('W', false) => 604_800,
                    ('H', true) => 3_600,
                    ('M', true) => 60,
                    ('S', true) => 1,
                    _ => return None,
                };
            }
        }
    }
    num.is_empty().then_some(total)
}

// --- Fetching ------------------------------------------------------------------

async fn get(client: &reqwest::Client, endpoint: &str, params: &[(&str, &str)], key: &str) -> Result<Value, String> {
    let resp = client
        .get(format!("{API}/{endpoint}"))
        .query(params)
        .query(&[("key", key)])
        .send()
        .await
        .map_err(|e| format!("Couldn't reach YouTube: {e}"))?;
    let status = resp.status();
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let reason = body["error"]["errors"][0]["reason"].as_str().unwrap_or("");
        let message = body["error"]["message"].as_str().unwrap_or("unknown error");
        return Err(format!("{reason}: {message}"));
    }
    Ok(body)
}

fn num(v: &Value) -> Option<u64> {
    v.as_str().and_then(|s| s.parse().ok())
}

async fn sample_comments(client: &reqwest::Client, video_id: &str, key: &str) -> Vec<(String, u64)> {
    let max = COMMENTS_PER_VIDEO.to_string();
    let params = [
        ("part", "snippet"),
        ("videoId", video_id),
        ("maxResults", max.as_str()),
        ("order", "relevance"),
        ("textFormat", "plainText"),
    ];
    // Disabled comments come back as a 403; that just means nothing to go on.
    let Ok(body) = get(client, "commentThreads", &params, key).await else {
        return Vec::new();
    };
    body["items"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let c = &item["snippet"]["topLevelComment"]["snippet"];
                    let text = c["textDisplay"].as_str()?.to_string();
                    Some((text, c["likeCount"].as_u64().unwrap_or(0)))
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Searches YouTube for `query` and returns up to KEEP picks, best first.
pub async fn find_tutorials(query: &str, key: &str) -> Result<Vec<TutorialVideo>, String> {
    let client = reqwest::Client::new();
    let max = SEARCH_RESULTS.to_string();
    let search = get(
        &client,
        "search",
        &[
            ("part", "snippet"),
            ("type", "video"),
            ("q", query),
            ("maxResults", max.as_str()),
            ("relevanceLanguage", "en"),
        ],
        key,
    )
    .await?;

    let ids: Vec<&str> = search["items"]
        .as_array()
        .map(|items| items.iter().filter_map(|i| i["id"]["videoId"].as_str()).collect())
        .unwrap_or_default();
    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let details = get(
        &client,
        "videos",
        &[("part", "snippet,statistics,contentDetails"), ("id", &ids.join(","))],
        key,
    )
    .await?;

    let mut candidates: Vec<TutorialVideo> = details["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| {
            let duration_seconds = parse_duration(v["contentDetails"]["duration"].as_str()?)?;
            let views = num(&v["statistics"]["viewCount"])?;
            if !eligible(duration_seconds, views) {
                return None;
            }
            let likes = num(&v["statistics"]["likeCount"]);
            let thumbs = &v["snippet"]["thumbnails"];
            let thumbnail_url = ["high", "medium", "default"]
                .iter()
                .find_map(|size| thumbs[size]["url"].as_str())
                .unwrap_or_default()
                .to_string();
            Some(TutorialVideo {
                video_id: v["id"].as_str()?.to_string(),
                title: v["snippet"]["title"].as_str()?.to_string(),
                channel: v["snippet"]["channelTitle"].as_str().unwrap_or_default().to_string(),
                thumbnail_url,
                duration_seconds,
                views,
                likes,
                comments_sampled: 0,
                positive_comments: 0,
                negative_comments: 0,
                score: base_score(views, likes),
            })
        })
        .collect();

    candidates.sort_by(|a, b| b.score.total_cmp(&a.score));
    candidates.truncate(COMMENT_SAMPLED);

    for c in &mut candidates {
        let s = comment_sentiment(&sample_comments(&client, &c.video_id, key).await);
        c.comments_sampled = s.sampled;
        c.positive_comments = s.positive;
        c.negative_comments = s.negative;
        c.score *= sentiment_factor(&s);
    }

    candidates.sort_by(|a, b| b.score.total_cmp(&a.score));
    candidates.truncate(KEEP);
    Ok(candidates)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_durations() {
        assert_eq!(parse_duration("PT4M13S"), Some(253));
        assert_eq!(parse_duration("PT1H"), Some(3600));
        assert_eq!(parse_duration("PT45S"), Some(45));
        assert_eq!(parse_duration("P1DT1S"), Some(86_401));
        assert_eq!(parse_duration("P0D"), Some(0));
        assert_eq!(parse_duration("garbage"), None);
        assert_eq!(parse_duration("PT12"), None);
    }

    #[test]
    fn filters_shorts_streams_and_tiny_videos() {
        assert!(eligible(600, 50_000));
        assert!(!eligible(45, 50_000));
        assert!(!eligible(3 * 3600, 50_000));
        assert!(!eligible(600, 300));
    }

    #[test]
    fn classifies_comments() {
        assert_eq!(classify_comment("Thank you, this finally clicked!"), Some(true));
        assert_eq!(classify_comment("Did this for a week and my throat hurts"), Some(false));
        assert_eq!(classify_comment("Thanks but I lost my voice for two days"), Some(false));
        assert_eq!(classify_comment("First technique that doesn’t hurt at all"), Some(true));
        assert_eq!(classify_comment("No pain, just a great explanation"), Some(true));
        assert_eq!(classify_comment("Who's here in 2026?"), None);
    }

    #[test]
    fn like_rate_is_shrunk_for_small_videos() {
        // 5 likes on 40 views is a 12.5% rate, but too little evidence to beat a
        // solid 4% on 500k views.
        assert!(base_score(500_000, Some(20_000)) > base_score(40, Some(5)));
        // Same reach, better approval wins.
        assert!(base_score(100_000, Some(5_000)) > base_score(100_000, Some(500)));
        // Hidden likes are neutral, not a penalty.
        assert!(base_score(100_000, None) > base_score(100_000, Some(100)));
    }

    #[test]
    fn sentiment_moves_the_score_within_bounds() {
        let none = Sentiment::default();
        assert_eq!(sentiment_factor(&none), 1.0);

        let praised = comment_sentiment(&vec![("This helped so much".to_string(), 50); 20]);
        let complained = comment_sentiment(&vec![("my throat hurts now".to_string(), 50); 20]);
        assert!(sentiment_factor(&praised) > 1.3 && sentiment_factor(&praised) < 1.5);
        assert!(sentiment_factor(&complained) < 0.7 && sentiment_factor(&complained) > 0.5);

        // A few painful comments are enough to lose to a slightly smaller, safer video.
        let mixed = comment_sentiment(&[
            ("thank you".to_string(), 10),
            ("this hurt my throat".to_string(), 400),
            ("hurts".to_string(), 200),
        ]);
        let big = base_score(2_000_000, Some(60_000)) * sentiment_factor(&mixed);
        let safe = base_score(800_000, Some(24_000)) * sentiment_factor(&praised);
        assert!(safe > big);
    }
}
