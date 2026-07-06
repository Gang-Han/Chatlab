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

// ---- Projects ----

const PROJECTS_STORAGE_KEY = 'chatlab-projects';

const newProjectInput = document.getElementById('new-project-input');
const newProjectBtn = document.getElementById('new-project-btn');

let projects = [];
try {
  projects = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY)) || [];
} catch (err) {
  projects = [];
}
projects.forEach((p) => {
  if (typeof p.summary !== 'string') p.summary = '';
});

function saveProjects() {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function makeProjectId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getProjectById(id) {
  return projects.find((p) => p.id === id) || null;
}

function createProject() {
  const name = newProjectInput.value.trim();
  if (!name) return;
  projects.push({ id: makeProjectId(), name, summary: '' });
  saveProjects();
  newProjectInput.value = '';
  renderConversationList();
}

newProjectBtn.addEventListener('click', createProject);
newProjectInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    createProject();
  }
});

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

// Conversations saved before per-conversation highlights/summary/project existed won't have these fields yet.
conversations.forEach((c) => {
  if (!Array.isArray(c.highlights)) c.highlights = [];
  if (typeof c.summary !== 'string') c.summary = '';
  if (typeof c.summarizedCount !== 'number') c.summarizedCount = 0;
  if (typeof c.projectId === 'undefined') c.projectId = null;
});

const RECENT_WINDOW = 6;

let currentConversationId = conversations.length > 0 ? conversations[0].id : null;
let draftProjectId = null;

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

function deleteConversation(id) {
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return;

  conversations.splice(idx, 1);
  saveConversations();

  if (currentConversationId === id) {
    currentConversationId = null;
    chatLog.innerHTML = '';
  }

  renderConversationList();
  renderHighlights();
}

function renderConversationRow(c) {
  const row = document.createElement('div');
  row.className = 'conversation-row';

  const item = document.createElement('div');
  item.className = `conversation-item${c.id === currentConversationId ? ' active' : ''}`;
  item.textContent = c.title;
  item.title = c.title;
  item.addEventListener('click', () => switchConversation(c.id));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'conversation-delete';
  deleteBtn.textContent = '×';
  deleteBtn.setAttribute('aria-label', 'Delete conversation');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteConversation(c.id);
  });

  row.appendChild(item);
  row.appendChild(deleteBtn);
  return row;
}

function renderProjectGroup(project) {
  const group = document.createElement('div');
  group.className = 'project-group';

  const header = document.createElement('div');
  header.className = 'project-header';

  const name = document.createElement('span');
  name.className = 'project-name';
  name.textContent = project.name;
  name.title = project.name;

  const actions = document.createElement('div');
  actions.className = 'project-actions';

  const summaryBox = document.createElement('textarea');
  summaryBox.className = 'project-summary-editor';
  summaryBox.placeholder = 'Project summary (background context for chats in this project)...';
  summaryBox.value = project.summary || '';
  summaryBox.hidden = true;
  summaryBox.addEventListener('input', () => {
    project.summary = summaryBox.value;
    saveProjects();
  });

  const newChatInProjectBtn = document.createElement('button');
  newChatInProjectBtn.type = 'button';
  newChatInProjectBtn.className = 'project-action-btn';
  newChatInProjectBtn.title = 'New chat in this project';
  newChatInProjectBtn.textContent = '+';
  newChatInProjectBtn.addEventListener('click', () => startNewChatInProject(project.id));

  const editSummaryBtn = document.createElement('button');
  editSummaryBtn.type = 'button';
  editSummaryBtn.className = 'project-action-btn';
  editSummaryBtn.title = 'Edit project summary';
  editSummaryBtn.textContent = '✎';
  editSummaryBtn.addEventListener('click', () => {
    summaryBox.hidden = !summaryBox.hidden;
  });

  actions.appendChild(newChatInProjectBtn);
  actions.appendChild(editSummaryBtn);
  header.appendChild(name);
  header.appendChild(actions);

  const convosContainer = document.createElement('div');
  convosContainer.className = 'project-conversations';
  conversations
    .filter((c) => c.projectId === project.id)
    .forEach((c) => convosContainer.appendChild(renderConversationRow(c)));

  group.appendChild(header);
  group.appendChild(summaryBox);
  group.appendChild(convosContainer);
  return group;
}

function renderConversationList() {
  conversationList.innerHTML = '';

  if (projects.length === 0 && conversations.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'conversation-empty';
    empty.textContent = 'No conversations yet.';
    conversationList.appendChild(empty);
    return;
  }

  projects.forEach((project) => {
    conversationList.appendChild(renderProjectGroup(project));
  });

  const unassigned = conversations.filter((c) => !c.projectId);

  if (projects.length > 0 && unassigned.length > 0) {
    const label = document.createElement('p');
    label.className = 'conversation-group-label';
    label.textContent = 'Other chats';
    conversationList.appendChild(label);
  }

  unassigned.forEach((c) => conversationList.appendChild(renderConversationRow(c)));
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
  renderHighlights();
  sidebar.classList.remove('open');
}

function startNewChat() {
  currentConversationId = null;
  draftProjectId = null;
  chatLog.innerHTML = '';
  renderConversationList();
  renderHighlights();
  sidebar.classList.remove('open');
  textarea.focus();
}

function startNewChatInProject(projectId) {
  currentConversationId = null;
  draftProjectId = projectId;
  chatLog.innerHTML = '';
  renderConversationList();
  renderHighlights();
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
      highlights: [],
      summary: '',
      summarizedCount: 0,
      projectId: draftProjectId,
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

function buildRequestContext() {
  const conversation = getCurrentConversation();
  if (!conversation) {
    return { summary: '', recentTurns: [], toSummarize: [], highlights: [], foldPoint: 0, projectSummary: '' };
  }

  // The current question was already persisted as the last message; it's sent
  // separately as `question`, so only messages before it count as prior context.
  const priorMessages = conversation.messages
    .filter((m) => m.role === 'user' || m.role === 'bot')
    .slice(0, -1);

  const toRole = (m) => (m.role === 'bot' ? 'assistant' : 'user');

  const foldPoint = Math.max(priorMessages.length - RECENT_WINDOW, 0);
  const summarizedCount = conversation.summarizedCount || 0;

  const recentTurns = priorMessages
    .slice(-RECENT_WINDOW)
    .map((m) => ({ role: toRole(m), content: m.text }));

  const toSummarize = priorMessages
    .slice(summarizedCount, foldPoint)
    .map((m) => ({ role: toRole(m), content: m.text }));

  const highlights = (conversation.highlights || []).map((h) => ({ text: h.text, note: h.note }));

  const project = conversation.projectId ? getProjectById(conversation.projectId) : null;
  const projectSummary = project ? (project.summary || '') : '';

  return { summary: conversation.summary || '', recentTurns, toSummarize, highlights, foldPoint, projectSummary };
}

async function sendMessage() {
  const question = textarea.value.trim();
  if (!question) return;

  addMessage(question, 'user');
  persistMessage(question, 'user');
  const context = buildRequestContext();
  textarea.value = '';
  autoResize();
  button.disabled = true;

  const pendingRow = addMessage('Thinking...', 'bot pending');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        projectSummary: context.projectSummary,
        summary: context.summary,
        recentTurns: context.recentTurns,
        toSummarize: context.toSummarize,
        highlights: context.highlights
      })
    });

    const data = await response.json();
    pendingRow.remove();

    if (!response.ok) {
      addMessage(data.error, 'error');
      persistMessage(data.error, 'error');
    } else {
      addMessage(data.answer, 'bot');
      persistMessage(data.answer, 'bot');

      const conversation = getCurrentConversation();
      if (conversation) {
        conversation.summary = data.summary || conversation.summary || '';
        if (context.toSummarize.length > 0) {
          conversation.summarizedCount = context.foldPoint;
        }
        saveConversations();
      }
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

// ---- Highlights (scoped per conversation) ----

// Highlights used to be stored globally across all conversations; that data is stale
// now that each conversation owns its own highlights, so drop it.
localStorage.removeItem('chatlab-highlights');

const highlightsPanel = document.getElementById('highlights-panel');
const highlightsToggle = document.getElementById('highlights-toggle');
const highlightsClose = document.getElementById('highlights-close');
const highlightsList = document.getElementById('highlights-list');
const highlightCountEl = document.getElementById('highlight-count');
const generateNoteBtn = document.getElementById('generate-note-btn');
const generatedNote = document.getElementById('generated-note');
const selectionPopup = document.getElementById('selection-popup');

function getCurrentHighlights() {
  const conversation = getCurrentConversation();
  return conversation ? conversation.highlights : [];
}

function saveHighlights() {
  saveConversations();
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
  const highlights = getCurrentHighlights();
  const conversation = getCurrentConversation();
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
      conversation.highlights = conversation.highlights.filter((x) => x.id !== h.id);
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
  const conversation = getCurrentConversation();
  if (!conversation) return;

  conversation.highlights.push({
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
  const highlights = getCurrentHighlights();

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
