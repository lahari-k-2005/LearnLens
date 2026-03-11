/*********************************
 * GLOBALS
 *********************************/
let API_KEY = null;
const classificationCache = {}; 
let debounceTimer = null;
let isRunning = false;

/*********************************
 * HELPERS
 *********************************/
function isValidVideoId(id) {
    return typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

/*********************************
 * LOAD API KEY
 *********************************/
async function loadAPIKey() {

    if (API_KEY) return API_KEY;

    const config = await fetch(chrome.runtime.getURL("config.json"))
        .then(r => r.json());

    API_KEY = config.API_KEY;
    return API_KEY;
}

/*********************************
 * FETCH VIDEO METADATA
 *********************************/
async function getVideoDescriptions(videoIds) {

    if (!videoIds.length || !API_KEY) return {};

    const cleanIds = videoIds.filter(isValidVideoId);
    if (!cleanIds.length) return {};

    const descriptions = {};
    const batches = chunkArray(cleanIds, 50);

    for (const batch of batches) {

        const url =
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(",")}&key=${API_KEY}`;

        try {

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                console.error("YT API error:", response.status);
                continue;
            }

            if (!Array.isArray(data.items)) continue;

            data.items.forEach(item => {

                const title = item.snippet?.title || "";
                const tags = item.snippet?.tags ? item.snippet.tags.join(" ") : "";

                descriptions[item.id] = `${title} ${tags}`;
            });

        } catch (err) {
            console.error("YT API fetch failed:", err);
        }
    }

    return descriptions;
}

/*********************************
 * CALL ML BACKEND
 *********************************/
async function classifyWithML(text) {

    try {

        const response = await fetch("http://localhost:5000/classify", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({text})
        });

        const result = await response.json();

        return result.label === 1;

    } catch (err) {

        console.error("ML error:", err);

        return true;
    }
}

/*********************************
 * EXTRACT VIDEO ID
 *********************************/
function extractVideoId(tile) {

    const a =
        tile.querySelector('a#thumbnail[href]') ||
        tile.querySelector('a[href*="watch?v="]') ||
        tile.querySelector('a[href*="/shorts/"]');

    if (!a) return null;

    let href = a.getAttribute("href");
    if (!href) return null;

    if (href.startsWith("/")) {
        href = "https://www.youtube.com" + href;
    }

    try {

        if (href.includes("watch")) {

            const v = new URL(href).searchParams.get("v");

            return isValidVideoId(v) ? v : null;
        }

        if (href.includes("/shorts/")) {

            const id = href.split("/shorts/")[1]?.split(/[?&#]/)[0];

            return isValidVideoId(id) ? id : null;
        }

    } catch {}

    return null;
}

/*********************************
 * BLUR NON EDUCATIONAL VIDEOS
 *********************************/
async function blurNonEducationalVideos() {

    if (isRunning) return;

    isRunning = true;

    try {

        await loadAPIKey();

        const tiles = document.querySelectorAll(
            "ytd-video-renderer, ytd-rich-item-renderer, ytd-rich-grid-media, ytd-compact-video-renderer, yt-lockup-view-model, yt-horizontal-list-renderer, ytm-shorts-lockup-view-model-v2"
        );

        const videoMap = {};
        const videoIds = [];

        tiles.forEach(tile => {

            const videoId = extractVideoId(tile);

            if (!isValidVideoId(videoId) || videoMap[videoId]) return;

            const blurTarget =
                tile.closest("ytd-rich-grid-media") ||
                tile.closest("ytd-video-renderer") ||
                tile;

            videoMap[videoId] = blurTarget;

            videoIds.push(videoId);
        });

        const descriptions = await getVideoDescriptions(videoIds);

        for (const videoId of videoIds) {

            const target = videoMap[videoId];
            if (!target) continue;

            if (classificationCache[videoId] !== undefined) {

                target.style.filter =
                    classificationCache[videoId] ? "none" : "blur(8px)";

                continue;
            }

            const content = descriptions[videoId];
            if (!content) continue;

            const isEducational = await classifyWithML(content);

            classificationCache[videoId] = isEducational;

            const thumbnailElement = target.querySelector('ytd-thumbnail');

            if (isEducational) {
                target.style.filter = "none";
                target.removeAttribute("data-blocked");
                if (thumbnailElement) thumbnailElement.removeAttribute("data-blocked");
            } else {
                target.style.filter = "blur(8px)";
                target.setAttribute("data-blocked", "true");
                if (thumbnailElement) thumbnailElement.setAttribute("data-blocked", "true");
            }
        }

    } finally {

        isRunning = false;
    }
}

/*********************************
 * ROUTE CHANGE
 *********************************/
function onRouteChange() {

    blurNonEducationalVideos();
}

/*********************************
 * OBSERVER
 *********************************/
const observer = new MutationObserver(() => {

    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {

        blurNonEducationalVideos();

    }, 600);
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

/*********************************
 * CLICK BLOCKER
 *********************************/
document.addEventListener("click", function (e) {

    // console.log("Click detected:", e.target);

    const link = e.target.closest('a[href*="/watch"], a[href*="/shorts/"]');
    // console.log("Video link:", link);

    if (!link) return;

    const blockedTile = link.closest('[data-blocked="true"]');
    // console.log("Blocked tile:", blockedTile);

    if (blockedTile) {

        // console.log("Blocked video clicked");

        e.preventDefault();
        e.stopPropagation();

        showWarningPopup(link.href);
    }

}, true);

/*********************************
 * POPUP
 *********************************/
function showWarningPopup(videoUrl) {

    if (document.getElementById("edu-warning-popup")) return;

    const popup = document.createElement("div");

    popup.id = "edu-warning-popup";

    popup.innerHTML = `
    <div style="
        position:fixed;
        top:0;
        left:0;
        width:100%;
        height:100%;
        background:rgba(0,0,0,0.6);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:999999;
    ">

        <div style="
            background:white;
            padding:25px;
            border-radius:10px;
            width:350px;
            text-align:center;
            font-family:sans-serif;
        ">

            <h2>⚠ Warning</h2>

            <p>This video was classified as <b>non-educational</b>.</p>

            <p>Watching it may distract you.</p>

            <div style="margin-top:20px;">

                <button id="cancelVideo"
                    style="padding:8px 16px;margin-right:10px;cursor:pointer;">
                    Cancel
                </button>

                <button id="openVideo"
                    style="padding:8px 16px;background:red;color:white;border:none;cursor:pointer;">
                    Open Anyway
                </button>

            </div>

        </div>

    </div>
    `;

    document.body.appendChild(popup);

    popup.querySelector("#cancelVideo").onclick = () => {
        popup.remove();
    };

    popup.querySelector("#openVideo").onclick = () => {
        window.location.href = videoUrl;
    };
}

/*********************************
 * YOUTUBE SPA NAVIGATION
 *********************************/
(function hookHistory(){

    const push = history.pushState;
    const replace = history.replaceState;

    history.pushState = function() {

        const ret = push.apply(this, arguments);

        setTimeout(onRouteChange, 300);

        return ret;
    };

    history.replaceState = function() {

        const ret = replace.apply(this, arguments);

        setTimeout(onRouteChange, 300);

        return ret;
    };

    window.addEventListener("popstate", () => {

        setTimeout(onRouteChange, 300);
    });

})();

/*********************************
 * INIT
 *********************************/
(async () => {

    await loadAPIKey();

    onRouteChange();

})();