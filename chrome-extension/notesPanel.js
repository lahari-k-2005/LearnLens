let quillInstance = null;
let panelVisible = false;


let userId = null;

chrome.storage.local.get(["learnlensUserId"], (result) => {
    userId = result.learnlensUserId;
    console.log("UserId in notes panel:", userId);
});

chrome.storage.onChanged.addListener((changes, area) => {

    if (area === "local" && changes.learnlensUserId) {

        userId = changes.learnlensUserId.newValue || null;

        console.log("UserId updated:", userId);

        if (userId) {
            loadUserTopics();   // reload notes
        } else {
            clearNotesPanel();  // remove notes after logout
        }
    }
});

let topics = {}; 
let topicIdMap = {};  // topicName -> topicId
let noteIdMap = {};   // topicName_noteName -> noteId

let currentTopic = null;

function isWatchPage() {
    return location.pathname === "/watch";
}



function showLoginPrompt() {

    if (document.getElementById("learnlens-login-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "learnlens-login-overlay";

    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999999";

    const popup = document.createElement("div");

    popup.style.background = "white";
    popup.style.padding = "25px";
    popup.style.borderRadius = "10px";
    popup.style.width = "300px";
    popup.style.textAlign = "center";
    popup.style.fontFamily = "Arial";
    popup.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";

    popup.innerHTML = `
        <h3 style="margin-bottom:10px;">🔒 Sign In Required</h3>
        <p style="font-size:14px;margin-bottom:20px;">
            Please sign in to access your notes.
        </p>

        <button id="learnlens-login-btn"
            style="
                background:#7b1fa2;
                color:white;
                border:none;
                padding:10px 16px;
                border-radius:6px;
                cursor:pointer;
                margin-right:8px;
            ">
            Sign In
        </button>

        <button id="learnlens-cancel-btn"
            style="
                background:#ddd;
                border:none;
                padding:10px 16px;
                border-radius:6px;
                cursor:pointer;
            ">
            Cancel
        </button>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Open extension popup
    document
        .getElementById("learnlens-login-btn")
        .addEventListener("click", () => {

            chrome.runtime.sendMessage({ action: "openAuthPopup" });

            overlay.remove();
        });

    document
        .getElementById("learnlens-cancel-btn")
        .addEventListener("click", () => {
            overlay.remove();
        });
}



// =============================
// CREATE TOGGLE ICON
// =============================
function createToggleIcon() {
    if (document.getElementById("learnlens-toggle-icon")) return;

    const icon = document.createElement("div");
    icon.id = "learnlens-toggle-icon";
    icon.innerText = "📝";
    icon.style.position = "fixed";
    icon.style.bottom = "30px";
    icon.style.right = "30px";
    icon.style.width = "55px";
    icon.style.height = "55px";
    icon.style.background = "linear-gradient(135deg,#7b1fa2,#9c27b0)";
    icon.style.color = "white";
    icon.style.borderRadius = "50%";
    icon.style.display = "flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.fontSize = "24px";
    icon.style.cursor = "pointer";
    icon.style.boxShadow = "0 5px 15px rgba(0,0,0,0.3)";
    icon.style.zIndex = 9999999;
    icon.style.transition = "all 0.2s ease";

    icon.onmouseenter = () => icon.style.transform = "scale(1.1)";
    icon.onmouseleave = () => icon.style.transform = "scale(1)";

    icon.addEventListener("click", () => {

      
        console.log("DEBUG userId:", userId);

        if (!userId) {
            console.log("DEBUG: User not logged in");
            showLoginPrompt();
            return;

        }

        console.log("DEBUG: User logged in, opening notes panel");
        
        createQuillPanel();
        icon.style.display = "none";    

    });

    document.body.appendChild(icon);
}





// =============================
// CREATE PANEL
// =============================

function createQuillPanel() {
    if (document.getElementById("learnlens-quill-panel")) return;

    const container = document.createElement("div");
    container.id = "learnlens-quill-panel";
    container.style.position = "fixed";
    container.style.top = "25px";
    container.style.right = "20px";
    container.style.width = "420px";
    container.style.height = "400px";
    container.style.background = "#ffffff";
    container.style.borderRadius = "12px";
    container.style.boxShadow = "0 8px 25px rgba(0,0,0,0.25)";
    container.style.zIndex = 9999999;
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.overflow = "hidden";
    container.style.fontFamily = "Arial, sans-serif";

    let isExpanded = false;

    // ===== Header =====
    const header = document.createElement("div");
    header.style.color = "white";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.fontWeight = "bold";
    header.style.cursor = "move";
    header.style.background = "linear-gradient(135deg,#7b1fa2,#9c27b0)";
    header.style.padding = "14px";
    header.style.fontSize = "16px";
    header.style.letterSpacing = "0.5px";
    header.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";

    let isDragging = false;
    let startX, startY;
    let currentX = 0;
    let currentY = 0;

    header.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        currentX = e.clientX - startX;
        currentY = e.clientY - startY;
        container.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    }

    const title = document.createElement("span");
    title.innerText = "📝 LearnLens Notes";
    title.style.fontSize = "15px";

    const buttonGroup = document.createElement("div");
    buttonGroup.style.display = "flex";
    buttonGroup.style.gap = "12px";

    const expandBtn = document.createElement("span");
    expandBtn.innerHTML = "⛶";
    expandBtn.style.fontSize = "15px";
    expandBtn.style.cursor = "pointer";
    expandBtn.addEventListener("click", () => {
        if (!isExpanded) {
            container.style.width = "500px";
            container.style.height = "530px";
            expandBtn.innerHTML = "🗗";
            expandBtn.style.fontSize = "15px";
            isExpanded = true;
        } else {
            container.style.width = "380px";
            container.style.height = "400px";
            expandBtn.innerHTML = "⛶";
            expandBtn.style.fontSize = "15px";
            isExpanded = false;
        }
    });

    const closeBtn = document.createElement("span");
    closeBtn.innerText = "✕";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "15px";
    closeBtn.addEventListener("click", () => {
        container.remove();
        panelVisible = false;
        document.getElementById("learnlens-toggle-icon").style.display = "flex";
    });

    buttonGroup.appendChild(expandBtn);
    buttonGroup.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(buttonGroup);
    container.appendChild(header);

    // =============================
    // CONTENT SECTION
    // =============================
    const contentWrapper = document.createElement("div");
    contentWrapper.style.flex = "1";
    contentWrapper.style.display = "flex";
    contentWrapper.style.overflow = "hidden";

    // =============================
    // SIDEBAR
    // =============================
    const sidebar = document.createElement("div");
    sidebar.style.width = "95px";
    sidebar.style.background = "#fafafa";
    sidebar.style.borderRight = "1px solid #e0e0e0";
    sidebar.style.padding = "10px";
    sidebar.style.gap = "10px";

    sidebar.style.display = "flex";
    sidebar.style.flexDirection = "column";
    // sidebar.style.overflowY = "auto";
    sidebar.style.position = "relative";


    const sidebarContent = document.createElement("div");
    sidebarContent.style.flex = "1";
    sidebarContent.style.overflowY = "auto";
    sidebarContent.style.display = "flex";
    sidebarContent.style.flexDirection = "column";
    sidebarContent.style.gap = "8px";

    sidebar.style.justifyContent = "space-between";

    sidebarContent.style.flex = "1";

    

    // Topic Input Row
    const inputRow = document.createElement("div");
    inputRow.style.display = "flex";
    inputRow.style.alignItems = "center";
    inputRow.style.gap = "4px";

    const topicInput = document.createElement("input");
    topicInput.type = "text";
    topicInput.placeholder = "New topic";
    topicInput.style.flex = "1";
    topicInput.style.padding = "5px";
    topicInput.style.borderRadius = "4px";
    topicInput.style.border = "1px solid #ccc";
    topicInput.style.fontSize = "12px";
    topicInput.style.width = "30px";

    // + symbol for adding topic
    const addTopicBtn = document.createElement("button");
    addTopicBtn.innerText = "+";
    addTopicBtn.style.padding = "3px 6px";
    addTopicBtn.style.border = "none";
    addTopicBtn.style.borderRadius = "4px";
    addTopicBtn.style.background = "#8e24aa";
    addTopicBtn.style.color = "white";
    addTopicBtn.style.cursor = "pointer";
    addTopicBtn.style.fontSize = "11px";

    inputRow.appendChild(topicInput);
    inputRow.appendChild(addTopicBtn);

    const topicList = document.createElement("div");
    topicList.style.display = "flex";
    topicList.style.flexDirection = "column";
    topicList.style.gap = "6px";

    // sidebar.appendChild(inputRow);
    // sidebar.appendChild(topicList);
    sidebarContent.appendChild(inputRow);
    sidebarContent.appendChild(topicList);
    sidebar.appendChild(sidebarContent);

    // button container
    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    // buttonRow.style.justifyContent = "space-between";
    buttonRow.style.gap = "8px";
    buttonRow.style.alignItems = "center";
    buttonRow.style.marginTop = "6px";

    
    // Single + button for notes
    const addNoteBtn = document.createElement("button");
    addNoteBtn.innerText = "+ Add Note";
    addNoteBtn.style.padding = "5px";
    addNoteBtn.style.border = "none";
    addNoteBtn.style.borderRadius = "4px";
    addNoteBtn.style.background = "#8e24aa";
    addNoteBtn.style.color = "white";
    addNoteBtn.style.cursor = "pointer";
    addNoteBtn.style.fontSize = "12px";
    // sidebar.appendChild(addNoteBtn);

    // Delete button for notes at bottom
    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "🗑";
    // deleteBtn.style.position = "absolute";
    // deleteBtn.style.bottom = "8px";
    // deleteBtn.style.left = "8px";
    deleteBtn.style.padding = "3px";
    deleteBtn.style.border = "none";
    deleteBtn.style.borderRadius = "4px";
    deleteBtn.style.background = "#ff4d4d";
    deleteBtn.style.color = "white";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.fontSize = "20px";
    // sidebar.appendChild(deleteBtn);


    buttonRow.appendChild(addNoteBtn);
    buttonRow.appendChild(deleteBtn);
    sidebar.appendChild(buttonRow);


    // Floating toast for messages
    const toast = document.createElement("div");
    toast.style.position = "absolute";
    toast.style.top = "50px";
    toast.style.right = "15px";
    toast.style.background = "#ff4d4d";
    toast.style.color = "white";
    toast.style.padding = "6px 12px";
    toast.style.borderRadius = "6px";
    toast.style.fontSize = "12px";
    toast.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";
    toast.style.zIndex = "20";

    container.appendChild(toast);

    function showToast(message, type = "error") {

        toast.innerText = message;

        if (type === "success") {
            toast.style.background = "#4CAF50";
        } else {
            toast.style.background = "#ff4d4d";
        }

        toast.style.opacity = "1";

        setTimeout(() => {
            toast.style.opacity = "0";
        }, 2000);
    }


    // =============================
    // DATA STRUCTURE
    // =============================
    let topics = {}; // { topicName: { noteName: content, notesContainer } }
    let currentTopic = null;
    let currentNote = null;
    let noteInputActive = false;

    function createNoteButton(topicName, noteName) {
        const noteBtn = document.createElement("button");
        noteBtn.innerText = noteName;
        noteBtn.style.marginLeft = "12px";
        noteBtn.style.fontSize = "11px";
        noteBtn.style.color = "#4a148c";
        noteBtn.style.cursor = "pointer";
        noteBtn.style.background = "#ede7f6";
        noteBtn.style.border = "1px solid #d1c4e9";
        noteBtn.style.padding = "4px 6px";
        noteBtn.style.borderRadius = "5px";
        noteBtn.style.transition = "0.2s";
        
        noteBtn.className = "learnlens-note";
        
        noteBtn.onmouseenter = () => noteBtn.style.background = "#d1c4e9";
        noteBtn.onmouseleave = () => noteBtn.style.background = "#ede7f6";

        // noteBtn.addEventListener("click", () => switchNote(topicName, noteName));

        noteBtn.addEventListener("click", () => {
            switchNote(topicName, noteName);
            // remove highlight from all notes
            document.querySelectorAll(".learnlens-note").forEach(btn=>{
                btn.style.background = "#ede7f6";
                btn.style.border = "1px solid #d1c4e9";
            });
            // highlight selected
            noteBtn.style.background = "#b39ddb";
            noteBtn.style.border = "1px solid #9575cd";
        });
        topics[topicName].notesContainer.appendChild(noteBtn);

    }

    

    function switchTopic(name) {
        if (currentTopic && currentNote && quillInstance) {
            topics[currentTopic].notes[currentNote] = quillInstance.root.innerHTML;
        }
        currentTopic = name;
        const topicData = topics[name];
        currentNote = null;
        // if (currentNote && quillInstance) {
        //     quillInstance.root.innerHTML = topicData.notes[currentNote];
        // }

        if (quillInstance) {
            if (currentNote) {
                quillInstance.root.innerHTML = topicData.notes[currentNote];
            } else {
                quillInstance.setContents([]); // clear editor for new topic
            }
        }

        [...topicList.children].forEach(container => {
            const btn = container.querySelector("button");
            if (!btn) return;
            if (btn.dataset.name === name) {
                btn.style.background = "#e3abeb";
                btn.style.color = "#4a148c";
            } else {
                btn.style.background = "#ffffff";
                btn.style.color = "#4a148c";
            }
        });
    }

    function switchNote(topicName, noteName) {
        if (currentTopic && currentNote && quillInstance) {
            topics[currentTopic].notes[currentNote] = quillInstance.root.innerHTML;
        }
        currentTopic = topicName;
        currentNote = noteName;
        quillInstance.root.innerHTML = topics[topicName].notes[noteName];
        noteHeader.innerText = `${topicName} / ${noteName}`;
    }



    async function loadNotesForTopic(topicName) {

        console.log("DEBUG: loadNotesForTopic called");

        const topicId = topicIdMap[topicName];

        console.log("DEBUG: Topic:", topicName);
        console.log("DEBUG: TopicId:", topicId);
        console.log("DEBUG: UserId:", userId);

        try {

            const res = await fetch(`http://localhost:5001/notes/${topicId}?userId=${userId}`);

            console.log("DEBUG: Notes API status:", res.status);

            const data = await res.json();

            console.log("DEBUG: Notes received:", data);

            // Reset notes memory
            topics[topicName].notes = {};

            data.forEach(note => {

                console.log("DEBUG: Storing note:", note.title);

                topics[topicName].notes[note.title] = note.content;

                noteIdMap[`${topicName}_${note.title}`] = note._id;

            });

            console.log("DEBUG: Notes stored in memory:", topics[topicName].notes);

        } catch (err) {

            console.error("Failed to fetch notes", err);

        }
    }



    async function loadUserTopics() {

        chrome.storage.local.get(["learnlensUserId"], async (result) => {

            const userId = result.learnlensUserId;

            console.log("DEBUG: userId used for fetching topics:", userId);

            if (!userId) return;

            try {

                const res = await fetch(`http://localhost:5001/topics?userId=${userId}`);
                const data = await res.json();

                console.log("DEBUG: Topics received from backend:", data);

                data.forEach(topic => {

                    const name = topic.name;

                    topicIdMap[name] = topic._id;

                    if (!topics[name]) {
                        createTopicButton(name);
                    }

                });

            } catch (err) {
                console.error("Failed to fetch topics", err);
            }

        });
    }



    function renderNotes(topicName) {

        console.log("DEBUG: Rendering notes for topic:", topicName);

        const topic = topics[topicName];

        topic.notesContainer.innerHTML = "";

        Object.keys(topic.notes).forEach(noteTitle => {

            console.log("DEBUG: Creating button for note:", noteTitle);

            createNoteButton(topicName, noteTitle);

        });

    }


    function createTopicButton(name) {
        const topicContainer = document.createElement("div");
        topicContainer.style.display = "flex";
        topicContainer.style.flexDirection = "column";
        topicContainer.style.gap = "2px";

        const btn = document.createElement("button");
        btn.dataset.name = name;
        btn.topicHeader = true;
        btn.style.display = "flex";
        btn.style.justifyContent = "space-between";
        btn.style.alignItems = "center";
        btn.style.padding = "6px";
        btn.style.border = "none";
        btn.style.borderRadius = "6px";
        btn.style.cursor = "pointer";
        btn.style.background = "#ffffff";
        btn.style.border = "1px solid #e0e0e0";
        btn.style.color = "#4a148c";
        btn.style.fontWeight = "500";
        btn.style.transition = "all 0.2s ease";

        // btn.onmouseenter = () => {
        //     if (currentTopic !== name) {
        //         btn.style.background = "#e1bee7";
        //     }
        // };

        // btn.onmouseleave = () => {
        //     if (currentTopic !== name) {
        //         btn.style.background = "#f3e5f5";
        //     }
        // };

        btn.innerHTML = `<span>${name}</span> <span style="transition:0.2s;" class="arrow">▶</span>`;
        btn.arrow = btn.querySelector(".arrow");

        const notesContainer = document.createElement("div");
        notesContainer.style.display = "none";
        notesContainer.style.flexDirection = "column";
        notesContainer.style.gap = "2px";
        notesContainer.style.marginLeft = "8px";

        topics[name] = { notes: {}, notesContainer };

        btn.addEventListener("click", async () => {
            notesContainer.style.display = notesContainer.style.display === "none" ? "flex" : "none";
            btn.arrow.style.transform = notesContainer.style.display === "none" ? "rotate(0deg)" : "rotate(90deg)";
            switchTopic(name);
            await loadNotesForTopic(name);
            console.log("Notes fetched:", topics[name].notes);
            renderNotes(name);
        });

        topicContainer.appendChild(btn);
        topicContainer.appendChild(notesContainer);
        topicList.appendChild(topicContainer);
    }

    addTopicBtn.addEventListener("click", async () => {
        // const name = topicInput.value.trim();
        // if (!name || topics[name]) return;

        const name = topicInput.value.trim().toLowerCase();

        if (!name) return;

        // Prevent duplicate topic for same user
        if (Object.keys(topics).some(t => t.toLowerCase() === name)) {
            showToast("Topic already exists");
            return;
        }

        if (!userId) {
            console.error("No userId available. Cannot create topic.");
            return;
        }

        try {
            const res = await fetch("http://localhost:5001/savetopics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, userId })
            });

            
            if (!res.ok) {
                const topicdata = await res.json();
                showToast(topicdata.message);
                return;
            }

            const data = await res.json();
            topicIdMap[name] = data._id;

            createTopicButton(name);
            switchTopic(name);
            // await loadNotesForTopic(name);
            topicInput.value = "";

            console.log("Creating topic:", name);
            console.log("Using userId:", userId);


        } catch (err) {
            console.error("Failed to create topic", err);
        }
    });



    topicInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addTopicBtn.click();
    });

    // + Add Note button behavior
    addNoteBtn.addEventListener("click", () => {
        if (!currentTopic || noteInputActive) return;
        noteInputActive = true;

        const noteInput = document.createElement("input");
        noteInput.type = "text";
        noteInput.placeholder = "Note name";
        noteInput.style.fontSize = "11px";
        noteInput.style.marginTop = "2px";
        noteInput.style.padding = "2px";
        noteInput.style.borderRadius = "4px";
        noteInput.style.border = "1px solid #ccc";

        topics[currentTopic].notesContainer.appendChild(noteInput);
        noteInput.focus();

        noteInput.addEventListener("keydown", async e => {
            if (e.key === "Enter") {

                e.preventDefault();
                enterPressed = true;

                const noteName = noteInput.value.trim();
                // if (!noteName || topics[currentTopic].notes[noteName]) {
                //     noteInput.remove();
                //     noteInputActive = false;
                //     return;
                // }

                if (!noteName) return;

                if (topics[currentTopic].notes[noteName]) {
                    showToast("Found duplicate notes");
                    return;
                }


                // topics[currentTopic].notes[noteName] = ""; // Initialize empty

                try {
                    const res = await fetch("http://localhost:5001/notes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            topicId: topicIdMap[currentTopic],
                            title: noteName,
                            content: "",
                            userId
                        })
                    });

                    const data = await res.json();
                    noteIdMap[`${currentTopic}_${noteName}`] = data._id;
                    topics[currentTopic].notes[noteName] = "";
                } catch (err) {
                    console.error("Failed to create note", err);
                }


                createNoteButton(currentTopic, noteName);
                currentNote = noteName; // Set as current note
                quillInstance.root.innerHTML = ""; // Clear editor for new note
                noteInput.remove();
                noteInputActive = false;

            }
        });

        noteInput.addEventListener("blur", () => {
            if (noteInputActive) {
                noteInput.remove();
                noteInputActive = false;
                console.log("Enter pressed for note");
                console.log("Current Topic:", currentTopic);
                console.log("Note Name:", noteInput.value.trim());

            }
        });
    });



    deleteBtn.addEventListener("click", async () => {

        if (!currentTopic) return;

        const topicId = topicIdMap[currentTopic];

        // ======================
        // DELETE NOTE
        // ======================
        if (currentNote && topics[currentTopic].notes[currentNote]) {

            const noteId = noteIdMap[`${currentTopic}_${currentNote}`];

            delete topics[currentTopic].notes[currentNote];

            const buttons = [...topics[currentTopic].notesContainer.children]
                .filter(b => b.tagName === "BUTTON");

            buttons.forEach(b => {
                if (b.innerText === currentNote) b.remove();
            });

            try {
                await fetch(`http://localhost:5001/notes/${noteId}?userId=${userId}`, {
                    method: "DELETE"
                });
            } catch (err) {
                console.error("Failed to delete note", err);
            }

            delete noteIdMap[`${currentTopic}_${currentNote}`];

            const remainingNotes = Object.keys(topics[currentTopic].notes);
            currentNote = remainingNotes[0] || null;

            if (currentNote && quillInstance) {
                quillInstance.root.innerHTML = topics[currentTopic].notes[currentNote];
            } else if (quillInstance) {
                quillInstance.root.innerHTML = "";
            }

        }

        // ======================
        // DELETE TOPIC
        // ======================
        else {

            try {
                await fetch(`http://localhost:5001/topics/${topicId}?userId=${userId}`, {
                    method: "DELETE"
                });
            } catch (err) {
                console.error("Failed to delete topic", err);
            }

            const topicContainers = [...topicList.children];

            topicContainers.forEach(container => {
                const btn = container.querySelector("button");
                if (btn && btn.dataset.name === currentTopic) {
                    container.remove();
                }
            });

            delete topics[currentTopic];
            delete topicIdMap[currentTopic];

            currentTopic = null;
            currentNote = null;

            if (quillInstance) {
                quillInstance.root.innerHTML = "";
            }

        }

    });



    // =============================
    // EDITOR
    // =============================
    const editorWrapper = document.createElement("div");
    editorWrapper.style.flex = "1";
    editorWrapper.style.display = "flex";
    editorWrapper.style.flexDirection = "column";
    editorWrapper.style.height = "100%";
    editorWrapper.style.overflow = "hidden";
    editorWrapper.style.position = "relative";
    editorWrapper.style.background = "#ffffff";
    editorWrapper.style.padding = "6px";

    const noteHeader = document.createElement("div");
    noteHeader.style.fontSize = "13px";
    noteHeader.style.fontWeight = "bold";
    noteHeader.style.color = "#555";
    noteHeader.style.marginBottom = "6px";
    noteHeader.innerText = "No note selected";

    editorWrapper.appendChild(noteHeader);

    const editorDiv = document.createElement("div");
    editorDiv.style.flex = "1";
    editorDiv.style.overflow = "hidden";
    editorDiv.style.paddingBottom = "40px";

    const divider = document.createElement("div");
    divider.style.height = "1px";
    divider.style.background = "#eee";
    divider.style.margin = "5px 0";

    editorWrapper.appendChild(divider);

    editorWrapper.appendChild(editorDiv);

    // =============================
    // BUTTON CONTAINER
    // =============================
    const buttonContainer = document.createElement("div");
    buttonContainer.style.position = "absolute";
    buttonContainer.style.bottom = "8px";
    buttonContainer.style.left = "8px";
    buttonContainer.style.right = "8px";

    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "space-between";   // center buttons
    buttonContainer.style.alignItems = "center";
    buttonContainer.style.flexWrap = "nowrap";        
    buttonContainer.style.gap = "8px";

    // buttonContainer.style.background = "#fafafa";
    // buttonContainer.style.borderTop = "1px solid #e0e0e0";
    buttonContainer.style.padding = "8px";
    // buttonContainer.style.borderRadius = "8px";


    // Create Save Button
    const saveBtn = document.createElement("button");
    saveBtn.innerText = "Save";

    // Save notification element
    const saveNotification = document.createElement("div");
    saveNotification.innerText = "Notes saved successfully!";
    saveNotification.style.position = "absolute";
    saveNotification.style.bottom = "40px";
    saveNotification.style.right = "8px";
    saveNotification.style.padding = "6px 12px";
    saveNotification.style.background = "#53a21f"; // matches theme
    saveNotification.style.color = "white";
    saveNotification.style.borderRadius = "4px";
    saveNotification.style.fontSize = "12px";
    saveNotification.style.opacity = "0";
    saveNotification.style.transition = "opacity 0.3s";
    saveNotification.style.zIndex = 10;

    // Append save notification to editor wrapper
    editorWrapper.appendChild(saveNotification);



    saveBtn.addEventListener("click", async () => {
        if (currentTopic && currentNote && quillInstance) {

            const content = quillInstance.root.innerHTML;
            topics[currentTopic].notes[currentNote] = content;

            const noteId = noteIdMap[`${currentTopic}_${currentNote}`];


            console.log("Save clicked");
            console.log("Current Topic:", currentTopic);
            console.log("Current Note:", currentNote);
            console.log("Note ID:", noteIdMap[`${currentTopic}_${currentNote}`]);
            console.log("Content:", quillInstance.root.innerHTML);


            try {
                await fetch(`http://localhost:5001/notes/${noteId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content, userId })
                });
            } catch (err) {
                console.error("Failed to save note", err);
            }

            // Keep your UI behavior unchanged
            saveNotification.style.opacity = "1";
            setTimeout(() => saveNotification.style.opacity = "0", 1500);

            const originalColor = saveBtn.style.background;
            saveBtn.style.background = "#6a1b9a";
            setTimeout(() => saveBtn.style.background = originalColor, 200);
        }
    });




    // =============================
    // IMAGE UPLOAD BUTTON
    // =============================
    const uploadBtn = document.createElement("button");
    uploadBtn.innerText = "Upload Image";
    // Hover effect
    uploadBtn.addEventListener("mousedown", () => {
        uploadBtn.style.background = "#4a148c"; // Darker on click
    });
    uploadBtn.addEventListener("mouseup", () => {
        uploadBtn.style.background = "#7b1fa2"; // Restore
    });
    uploadBtn.addEventListener("mouseleave", () => {
        uploadBtn.style.background = "#7b1fa2";
    });

    // Click behavior
    uploadBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
            const file = input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                const range = quillInstance.getSelection();
                const index = range ? range.index : quillInstance.getLength();
                quillInstance.insertEmbed(index, 'image', reader.result);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });

    // Append upload button to editor wrapper
    // editorWrapper.appendChild(uploadBtn);

    // =============================
    // EXPORT PDF BUTTON
    // =============================

    const exportBtn = document.createElement("button");
    exportBtn.innerText = "Export PDF";
    exportBtn.addEventListener("click", () => {

        if (!currentTopic || !currentNote || !quillInstance) {
            alert("No note to export");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const delta = quillInstance.getContents();
        let y = 20;

        doc.setFontSize(16);
        doc.text(`${currentTopic} - ${currentNote}`, 10, y);
        y += 10;

        delta.ops.forEach(op => {

            if (typeof op.insert === "string") {

                const lines = op.insert.split("\n");

                lines.forEach(line => {
                    if (line.trim() !== "") {

                        const wrapped = doc.splitTextToSize(line, 180);

                        wrapped.forEach(w => {
                            doc.text(w, 10, y);
                            y += 7;
                        });

                    }
                });

            }

            if (op.insert.image) {
                doc.addImage(op.insert.image, "JPEG", 10, y, 100, 60);
                y += 65;
            }

        });

        doc.save(`${currentTopic}_${currentNote}.pdf`);

    });


    // =============================
    // EXPORT WORD BUTTON
    // =============================


    const exportWordBtn = document.createElement("button");
    exportWordBtn.innerText = "Export Word";

    exportWordBtn.addEventListener("click", () => {

        if (!currentTopic || !currentNote || !quillInstance) {
            alert("No note to export");
            return;
        }

        const content = quillInstance.root.innerHTML;

        const html = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                xmlns:w='urn:schemas-microsoft-com:office:word'>
            <head>
                <meta charset="utf-8">
                <title>${currentTopic} - ${currentNote}</title>
            </head>
            <body>
                <h2>${currentTopic} - ${currentNote}</h2>
                ${content}
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff', html], {
            type: 'application/msword'
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${currentTopic}_${currentNote}.doc`;
        link.click();

        URL.revokeObjectURL(url);
    });


    function styleButton(btn, color) {

        btn.style.padding = "6px 10px";
        btn.style.borderRadius = "8px";
        btn.style.border = "none";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "11px";
        btn.style.fontWeight = "500";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.gap = "4px";
        btn.style.background = color;
        btn.style.color = "white";
        btn.style.transition = "all 0.2s ease";

        btn.onmouseenter = () => btn.style.opacity = "0.85";
        btn.onmouseleave = () => btn.style.opacity = "1";
    }

    styleButton(exportBtn, "#1976D2");
    styleButton(exportWordBtn, "#1e88e5");
    styleButton(uploadBtn, "#8e24aa");
    styleButton(saveBtn, "#7b1fa2");
    styleButton(deleteBtn, "#ef5350");

    buttonContainer.appendChild(exportBtn);
    buttonContainer.appendChild(exportWordBtn);
    buttonContainer.appendChild(uploadBtn);
    buttonContainer.appendChild(saveBtn);

    editorWrapper.appendChild(buttonContainer);


    // editorWrapper.appendChild(saveBtn);
    contentWrapper.appendChild(sidebar);
    contentWrapper.appendChild(editorWrapper);
    container.appendChild(contentWrapper);
    document.body.appendChild(container);

    loadUserTopics();

    ["keydown", "keyup", "keypress"].forEach(eventType => {
        container.addEventListener(eventType, (e) => {
            e.stopPropagation();
        });
    });


    quillInstance = new Quill(editorDiv, {
        theme: "snow",
        modules: {
            toolbar: [
                ["bold", "italic", "underline"],
                [{ list: "ordered" }, { list: "bullet" }],
                ["clean"]
            ]
        }
    });

    setTimeout(() => {
        const toolbar = container.querySelector(".ql-toolbar");
        const qlContainer = container.querySelector(".ql-container");
        if (toolbar) {
            toolbar.style.border = "none";
            toolbar.style.borderBottom = "1px solid #7b1fa2";
        }
        if (qlContainer) {
            qlContainer.style.border = "#f3e5f5";
            qlContainer.style.flex = "1";
            qlContainer.style.display = "flex";
            qlContainer.style.flexDirection = "column";
        }
        const editor = container.querySelector(".ql-editor");
        if (editor) {
            editor.style.flex = "1";
            editor.style.overflowY = "auto";
        }
    }, 0);

    panelVisible = true;
}













// =============================
function removePanelCompletely() {
    const panel = document.getElementById("learnlens-quill-panel");
    const icon = document.getElementById("learnlens-toggle-icon");
    if (panel) panel.remove();
    if (icon) icon.remove();
    panelVisible = false;
}

function handlePageChange() {
    if (isWatchPage()) {
        createToggleIcon();
    } else {
        removePanelCompletely();
    }
}

let lastUrl = location.href;

const youtubeNavigationObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        handlePageChange();
    }
});

youtubeNavigationObserver.observe(document.body, {
    childList: true,
    subtree: true
});

window.addEventListener("load", handlePageChange);


