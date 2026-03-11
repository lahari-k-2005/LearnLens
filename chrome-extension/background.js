console.log("LearnLens background service worker started");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    console.log("Message received:", message);

    if (message.action === "openAuthPopup") {

        console.log("Opening login popup");

        chrome.action.openPopup();
    }

});