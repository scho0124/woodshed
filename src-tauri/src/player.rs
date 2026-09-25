//! Plays a tutorial in a Woodshed window instead of the browser.
//!
//! YouTube's embedded player won't start (Error 153, "Video player configuration
//! error") unless the page embedding it sends an http(s) Referer. Release builds
//! serve the app from tauri://localhost, which doesn't, so an iframe in the main
//! window only works under `tauri dev`. Instead the player window loads a small
//! page whose base URL is https://<app identifier>/, which is how YouTube asks
//! native apps to identify themselves.
//!
//! Setting that base URL needs WebKitGTK's load_html, so on other platforms the
//! video opens in the browser as before.

use tauri::{AppHandle, Url};
use tauri_plugin_opener::OpenerExt;

pub const LABEL: &str = "tutorial";

/// YouTube video IDs are 11 characters of [A-Za-z0-9_-]. Checked because the
/// ID goes into the player's HTML.
pub fn is_video_id(id: &str) -> bool {
    id.len() == 11 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn player_html(video_id: &str) -> String {
    format!(
        r#"<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {{ margin: 0; height: 100%; overflow: hidden; background: #000; }}
  iframe {{ display: block; width: 100%; height: 100%; border: 0; }}
</style>
</head>
<body>
<iframe
  src="https://www.youtube-nocookie.com/embed/{video_id}?autoplay=1&rel=0"
  referrerpolicy="strict-origin-when-cross-origin"
  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
  allowfullscreen></iframe>
</body>
</html>"#
    )
}

/// YouTube pages other than the player itself (the title and channel links)
/// belong in the browser, where the user is signed in.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn opens_in_browser(url: &Url) -> bool {
    let youtube = url.host_str().is_some_and(|h| {
        ["youtube.com", "youtube-nocookie.com", "youtu.be"]
            .iter()
            .any(|d| h == *d || h.strip_suffix(d).is_some_and(|sub| sub.ends_with('.')))
    });
    youtube && !url.path().starts_with("/embed/")
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn open_in_browser(app: &AppHandle, url: &Url) {
    if matches!(url.scheme(), "http" | "https") {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

/// Plays `video_id` in the tutorial window, opening it if needed.
pub fn watch(app: &AppHandle, video_id: &str, title: &str) -> Result<(), String> {
    if !is_video_id(video_id) {
        return Err(format!("Not a YouTube video ID: {video_id}"));
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = title;
        app.opener()
            .open_url(format!("https://www.youtube.com/watch?v={video_id}"), None::<&str>)
            .map_err(|e| e.to_string())
    }

    #[cfg(target_os = "linux")]
    {
        use tauri::webview::NewWindowResponse;
        use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

        let window = match app.get_webview_window(LABEL) {
            Some(window) => window,
            None => {
                let (nav_app, popup_app) = (app.clone(), app.clone());
                WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External("about:blank".parse().unwrap()))
                    .inner_size(960.0, 540.0)
                    .min_inner_size(480.0, 270.0)
                    .center()
                    .on_navigation(move |url| {
                        let leave = opens_in_browser(url);
                        if leave {
                            open_in_browser(&nav_app, url);
                        }
                        !leave
                    })
                    // "Watch on YouTube", up-next videos and ad links open new windows.
                    .on_new_window(move |url, _| {
                        open_in_browser(&popup_app, &url);
                        NewWindowResponse::Deny
                    })
                    .build()
                    .map_err(|e| e.to_string())?
            }
        };

        let html = player_html(video_id);
        let base = format!("https://{}/", app.config().identifier);
        window
            .with_webview(move |webview| {
                use webkit2gtk::WebViewExt;
                webview.inner().load_html(&html, Some(&base));
            })
            .map_err(|e| e.to_string())?;
        let _ = window.set_title(title);
        let _ = window.unminimize();
        window.set_focus().map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_video_ids() {
        assert!(is_video_id("M7lc1UVf-VE"));
        assert!(is_video_id("a_b-C1d2E3f"));
        assert!(!is_video_id("M7lc1UVf-V"));
        assert!(!is_video_id("M7lc1UVf-VEx"));
        assert!(!is_video_id("M7lc1U\"><sc"));
        assert!(!is_video_id(""));
    }

    #[test]
    fn keeps_the_player_and_sends_youtube_pages_to_the_browser() {
        let url = |s: &str| Url::parse(s).unwrap();
        assert!(!opens_in_browser(&url("https://com.woodshed.app/")));
        assert!(!opens_in_browser(&url("about:blank")));
        assert!(!opens_in_browser(&url("https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1")));
        assert!(!opens_in_browser(&url("https://www.youtube.com/embed/M7lc1UVf-VE")));
        assert!(opens_in_browser(&url("https://www.youtube.com/watch?v=M7lc1UVf-VE")));
        assert!(opens_in_browser(&url("https://www.youtube-nocookie.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw")));
        assert!(opens_in_browser(&url("https://youtu.be/M7lc1UVf-VE")));
        // Look-alike hosts aren't YouTube.
        assert!(!opens_in_browser(&url("https://notyoutube.com/watch")));
    }

    #[test]
    fn player_embeds_the_video() {
        let html = player_html("M7lc1UVf-VE");
        assert!(html.contains(r#"src="https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1&rel=0""#));
        assert!(html.contains(r#"referrerpolicy="strict-origin-when-cross-origin""#));
    }
}
