const form = document.getElementById('chat-form');
const textarea = document.getElementById('question');
const chatLog = document.getElementById('chat-log');
const button = form.querySelector('button');

const MAX_TEXTAREA_HEIGHT = 200;

function autoResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px';
}

function addMessage(text, role) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  row.appendChild(bubble);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
  return row;
}

// ---- Conversation history ----

const CONVERSATIONS_STORAGE_KEY = 'chatlab-conversations';

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const newChatBtn = document.getElementById('new-chat-btn');
const conversationList = document.getElementById('conversation-list');

let conversations = [];
try {
  conversations = JSON.parse(localStorage.getItem(CONVERSATIONS_STORAGE_KEY)) || [];
} catch (err) {
  conversations = [];
}

let currentConversationId = conversations.length > 0 ? conversations[0].id : null;

function saveConversations() {
  localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
}

function makeConversationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromMessage(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 40 ? `${flat.slice(0, 40)}...` : flat || 'New chat';
}

function getCurrentConversation() {
  return conversations.find((c) => c.id === currentConversationId) || null;
}

function renderConversationList() {
  conversationList.innerHTML = '';

  if (conversations.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'conversation-empty';
    empty.textContent = 'No conversations yet.';
    conversationList.appendChild(empty);
    return;
  }

  conversations.forEach((c) => {
    const item = document.createElement('div');
    item.className = `conversation-item${c.id === currentConversationId ? ' active' : ''}`;
    item.textContent = c.title;
    item.title = c.title;
    item.addEventListener('click', () => switchConversation(c.id));
    conversationList.appendChild(item);
  });
}

function renderChatLog(conversation) {
  chatLog.innerHTML = '';
  if (!conversation) return;
  conversation.messages.forEach((m) => addMessage(m.text, m.role));
}

function switchConversation(id) {
  if (id === currentConversationId) return;
  currentConversationId = id;
  renderChatLog(getCurrentConversation());
  renderConversationList();
  sidebar.classList.remove('open');
}

function startNewChat() {
  currentConversationId = null;
  chatLog.innerHTML = '';
  renderConversationList();
  sidebar.classList.remove('open');
  textarea.focus();
}

function persistMessage(text, role) {
  let conversation = getCurrentConversation();

  if (!conversation) {
    conversation = {
      id: makeConversationId(),
      title: titleFromMessage(text),
      messages: [],
      updatedAt: new Date().toISOString()
    };
    conversations.unshift(conversation);
    currentConversationId = conversation.id;
  }

  conversation.messages.push({ text, role });
  conversation.updatedAt = new Date().toISOString();
  saveConversations();
  renderConversationList();
}

newChatBtn.addEventListener('click', startNewChat);
sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

renderChatLog(getCurrentConversation());
renderConversationList();

async function sendMessage() {
  const question = textarea.value.trim();
  if (!question) return;

  addMessage(question, 'user');
  persistMessage(question, 'user');
  textarea.value = '';
  autoResize();
  button.disabled = true;

  const pendingRow = addMessage('Thinking...', 'bot pending');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await response.json();
    pendingRow.remove();

    if (!response.ok) {
      addMessage(data.error, 'error');
      persistMessage(data.error, 'error');
    } else {
      addMessage(data.answer, 'bot');
      persistMessage(data.answer, 'bot');
    }
  } catch (err) {
    pendingRow.remove();
    addMessage('Could not reach the server.', 'error');
    persistMessage('Could not reach the server.', 'error');
  } finally {
    button.disabled = false;
    textarea.focus();
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});

textarea.addEventListener('input', autoResize);

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Plain Enter is left to the browser's default behavior, which inserts a newline in a textarea.
});

// ---- Highlights ----

const HIGHLIGHTS_STORAGE_KEY = 'chatlab-highlights';

const highlightsPanel = document.getElementById('highlights-panel');
const highlightsToggle = document.getElementById('highlights-toggle');
const highlightsClose = document.getElementById('highlights-close');
const highlightsList = document.getElementById('highlights-list');
const highlightCountEl = document.getElementById('highlight-count');
const generateNoteBtn = document.getElementById('generate-note-btn');
const generatedNote = document.getElementById('generated-note');
const selectionPopup = document.getElementById('selection-popup');

let highlights = [];
try {
  highlights = JSON.parse(localStorage.getItem(HIGHLIGHTS_STORAGE_KEY)) || [];
} catch (err) {
  highlights = [];
}

function saveHighlights() {
  localStorage.setItem(HIGHLIGHTS_STORAGE_KEY, JSON.stringify(highlights));
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderHighlights() {
  highlightCountEl.textContent = highlights.length;
  highlightsList.innerHTML = '';

  if (highlights.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'highlights-empty';
    empty.textContent = 'Select text in a response to highlight it.';
    highlightsList.appendChild(empty);
    return;
  }

  highlights.forEach((h) => {
    const item = document.createElement('div');
    item.className = 'highlight-item';

    const quote = document.createElement('blockquote');
    quote.className = 'highlight-text';
    quote.textContent = h.text;

    const note = document.createElement('textarea');
    note.className = 'highlight-note';
    note.placeholder = 'Add a note...';
    note.value = h.note;
    note.addEventListener('input', () => {
      h.note = note.value;
      saveHighlights();
    });

    const meta = document.createElement('div');
    meta.className = 'highlight-meta';

    const time = document.createElement('span');
    time.textContent = formatTimestamp(h.timestamp);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'highlight-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      highlights = highlights.filter((x) => x.id !== h.id);
      saveHighlights();
      renderHighlights();
    });

    meta.appendChild(time);
    meta.appendChild(removeBtn);

    item.appendChild(quote);
    item.appendChild(note);
    item.appendChild(meta);
    highlightsList.appendChild(item);
  });
}

function addHighlight(text) {
  highlights.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    note: '',
    timestamp: new Date().toISOString()
  });
  saveHighlights();
  renderHighlights();
  highlightsPanel.classList.add('open');
}

function getBotBubbleFromNode(node) {
  const el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!el || !el.closest) return null;
  const bubble = el.closest('.bubble');
  if (!bubble) return null;
  const row = bubble.closest('.message-row');
  if (row && row.classList.contains('bot') && !row.classList.contains('pending')) {
    return bubble;
  }
  return null;
}

function hideSelectionPopup() {
  selectionPopup.hidden = true;
  delete selectionPopup.dataset.text;
}

function showSelectionPopup(rect, text) {
  const top = Math.max(rect.top - 40, 8);
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - 110);
  selectionPopup.style.top = `${top}px`;
  selectionPopup.style.left = `${left}px`;
  selectionPopup.dataset.text = text;
  selectionPopup.hidden = false;
}

document.addEventListener('mouseup', (e) => {
  if (selectionPopup.contains(e.target)) return;

  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    if (!text || selection.rangeCount === 0) {
      hideSelectionPopup();
      return;
    }

    const bubble = getBotBubbleFromNode(selection.anchorNode);
    if (!bubble) {
      hideSelectionPopup();
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    showSelectionPopup(rect, text);
  }, 0);
});

selectionPopup.addEventListener('mousedown', (e) => {
  e.preventDefault();
});

selectionPopup.addEventListener('click', () => {
  const text = selectionPopup.dataset.text;
  if (text) {
    addHighlight(text);
  }
  hideSelectionPopup();
  window.getSelection().removeAllRanges();
});

highlightsToggle.addEventListener('click', () => {
  highlightsPanel.classList.toggle('open');
});

highlightsClose.addEventListener('click', () => {
  highlightsPanel.classList.remove('open');
});

generateNoteBtn.addEventListener('click', () => {
  if (highlights.length === 0) {
    generatedNote.value = 'No highlights yet. Select text in a response to add one.';
    generatedNote.hidden = false;
    return;
  }

  const lines = ['# Highlights Note', ''];
  highlights.forEach((h, i) => {
    lines.push(`## Highlight ${i + 1}`);
    lines.push(`> ${h.text.replace(/\n/g, '\n> ')}`);
    lines.push('');
    lines.push(`**Note:** ${h.note.trim() || '_No note added_'}`);
    lines.push('');
    lines.push(`_${formatTimestamp(h.timestamp)}_`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  generatedNote.value = lines.join('\n');
  generatedNote.hidden = false;
});

renderHighlights();
