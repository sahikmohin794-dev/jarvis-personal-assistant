
const $ = (selector) => document.querySelector(selector);

const clock = $("#clock");
const date = $("#date");
const message = $("#systemMessage");
const commandInput = $("#commandInput");
const commandForm = $("#commandForm");
const voiceButton = $("#voiceButton");
const notesList = $("#notesList");
const noteForm = $("#noteForm");
const noteInput = $("#noteInput");
const historyList = $("#historyList");
const noteCount = $("#noteCount");

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString();
  date.textContent = now.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}
updateClock();
setInterval(updateClock, 1000);

function showMessage(text) {
  message.textContent = text;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

async function logCommand(command) {
  try {
    await api("/api/commands", {
      method: "POST",
      body: JSON.stringify({ command })
    });
    await loadHistory();
  } catch (error) {
    console.error("Could not save command:", error);
  }
}

function openSearch(query) {
  window.open(
    "https://www.google.com/search?q=" + encodeURIComponent(query),
    "_blank",
    "noopener,noreferrer"
  );
}

async function runCommand(rawCommand) {
  const command = rawCommand.trim();
  if (!command) return;

  showMessage("Processing: " + command);
  await logCommand(command);

  const lower = command.toLowerCase();
  let response;

  if (/\bhelp\b|\bwhat can you do\b/.test(lower)) {
    response = "Try: what time is it, open YouTube, open Google, search for cats, or remember buy milk.";
  } else if (/\btime\b/.test(lower)) {
    response = "The time is " + new Date().toLocaleTimeString();
  } else if (/\bdate\b|\bday is it\b/.test(lower)) {
    response = "Today is " + new Date().toLocaleDateString(undefined, { dateStyle: "full" });
  } else if (lower.includes("open youtube")) {
    window.open("https://www.youtube.com/", "_blank", "noopener,noreferrer");
    response = "Opening YouTube.";
  } else if (lower.includes("open google")) {
    window.open("https://www.google.com/", "_blank", "noopener,noreferrer");
    response = "Opening Google.";
  } else if (lower.startsWith("search for ")) {
    const query = command.slice("search for ".length).trim();
    if (query) {
      openSearch(query);
      response = "Searching Google for " + query;
    } else {
      response = "Tell me what you want to search for.";
    }
  } else if (lower.startsWith("remember ")) {
    const note = command.slice("remember ".length).trim();
    if (note) {
      try {
        await api("/api/notes", {
          method: "POST",
          body: JSON.stringify({ text: note })
        });
        await loadNotes();
        response = "I saved that note.";
      } catch (error) {
        response = "I could not save the note: " + error.message;
      }
    } else {
      response = "Tell me what I should remember.";
    }
  } else if (lower === "show notes" || lower === "read my notes") {
    await loadNotes();
    response = "Your saved notes are displayed in Memory Notes.";
  } else {
    response = "I don't know that command yet. Type help to see examples.";
  }

  showMessage(response);
  speak(response);
}

commandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const command = commandInput.value;
  commandInput.value = "";
  await runCommand(command);
});

document.querySelectorAll(".quick-command").forEach((button) => {
  button.addEventListener("click", () => runCommand(button.dataset.command));
});

async function loadNotes() {
  try {
    const notes = await api("/api/notes");
    noteCount.textContent = `${notes.length} NOTE${notes.length === 1 ? "" : "S"}`;
    notesList.replaceChildren();

    if (notes.length === 0) {
      notesList.innerHTML = '<p class="muted">No notes yet. Save your first note above.</p>';
      return;
    }

    notes.forEach((note) => {
      const item = document.createElement("div");
      item.className = "note-item";

      const text = document.createElement("span");
      text.className = "note-text";
      text.textContent = note.text;

      const del = document.createElement("button");
      del.className = "delete-note";
      del.textContent = "DELETE";
      del.addEventListener("click", async () => {
        try {
          await api(`/api/notes/${note.id}`, { method: "DELETE" });
          await loadNotes();
          showMessage("Note deleted.");
        } catch (error) {
          showMessage(error.message);
        }
      });

      item.append(text, del);
      notesList.append(item);
    });
  } catch (error) {
    notesList.textContent = "Could not load notes. Check that the server is running.";
  }
}

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = noteInput.value.trim();
  if (!text) return;

  try {
    await api("/api/notes", {
      method: "POST",
      body: JSON.stringify({ text })
    });
    noteInput.value = "";
    await loadNotes();
    showMessage("Note saved successfully.");
  } catch (error) {
    showMessage("Could not save note: " + error.message);
  }
});

async function loadHistory() {
  try {
    const commands = await api("/api/commands");
    historyList.replaceChildren();

    if (commands.length === 0) {
      historyList.innerHTML = '<p class="muted">Your commands will appear here.</p>';
      return;
    }

    commands.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "history-item";

      const command = document.createElement("div");
      command.textContent = entry.command;

      const time = document.createElement("small");
      time.textContent = new Date(entry.created_at + "Z").toLocaleString();

      item.append(command, time);
      historyList.append(item);
    });
  } catch (error) {
    historyList.textContent = "Could not load command history.";
  }
}

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    voiceButton.classList.add("listening");
    voiceButton.textContent = "🔴 LISTENING...";
    showMessage("Listening. Speak your command.");
  };

  recognition.onresult = (event) => {
    const spoken = event.results[0][0].transcript;
    commandInput.value = spoken;
    runCommand(spoken);
  };

  recognition.onerror = (event) => {
    showMessage("Voice error: " + event.error + ". You can type a command instead.");
  };

  recognition.onend = () => {
    voiceButton.classList.remove("listening");
    voiceButton.innerHTML = "<span>🎙</span> ACTIVATE VOICE";
  };

  voiceButton.addEventListener("click", () => {
    try {
      recognition.start();
    } catch (error) {
      showMessage("Voice recognition is already starting. Please wait.");
    }
  });
} else {
  voiceButton.addEventListener("click", () => {
    showMessage("Voice recognition is unavailable in this browser. Try Microsoft Edge or Google Chrome.");
  });
}

loadNotes();
loadHistory();
