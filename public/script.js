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

  if (role === 'bot') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const btwBtn = document.createElement('button');
    btwBtn.type = 'button';
    btwBtn.className = 'btw-trigger';
    btwBtn.textContent = 'BTW';
    btwBtn.addEventListener('click', () => openBtwPanel(text));

    actions.appendChild(btwBtn);
    row.appendChild(actions);
  }

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

// Migrate the old manual `summary` field to `projectBackground`, and add the new
// automatic `projectRollingSummary` layer. Persist immediately so the rename sticks.
let migratedProjects = false;
projects.forEach((p) => {
  if (typeof p.projectBackground !== 'string') {
    p.projectBackground = typeof p.summary === 'string' ? p.summary : '';
    migratedProjects = true;
  }
  if (typeof p.summary !== 'undefined') {
    delete p.summary;
    migratedProjects = true;
  }
  if (typeof p.projectRollingSummary !== 'string') {
    p.projectRollingSummary = '';
    migratedProjects = true;
  }
  if (typeof p.isCollapsed !== 'boolean') {
    p.isCollapsed = true;
    migratedProjects = true;
  }
});

function saveProjects() {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

if (migratedProjects) saveProjects();

function makeProjectId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getProjectById(id) {
  return projects.find((p) => p.id === id) || null;
}

function createProject() {
  const name = newProjectInput.value.trim();
  if (!name) return;
  projects.push({
    id: makeProjectId(),
    name,
    projectBackground: '',
    projectRollingSummary: '',
    isCollapsed: true
  });
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

// ---- UI state (sidebar collapse/expand only — not memory) ----

const UI_STATE_STORAGE_KEY = 'chatlab-ui-state';

let uiState = { otherChatsCollapsed: true };
try {
  const storedUiState = JSON.parse(localStorage.getItem(UI_STATE_STORAGE_KEY));
  if (storedUiState && typeof storedUiState === 'object') {
    uiState = { otherChatsCollapsed: true, ...storedUiState };
  }
} catch (err) {
  // keep defaults
}

function saveUiState() {
  localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(uiState));
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

function deleteProject(id) {
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return;

  // Destructive by design: permanently delete every conversation that belongs to
  // this project (messages, summary, highlights) rather than reassigning them.
  for (let i = conversations.length - 1; i >= 0; i--) {
    if (conversations[i].projectId === id) {
      if (conversations[i].id === currentConversationId) {
        currentConversationId = null;
        chatLog.innerHTML = '';
      }
      conversations.splice(i, 1);
    }
  }
  saveConversations();

  projects.splice(idx, 1);
  saveProjects();

  renderConversationList();
  renderHighlights();
}

// ---- Shared kebab (three-dot) menu ----

let closeOpenKebabMenu = null;

function createKebabMenu(actions) {
  const wrapper = document.createElement('div');
  wrapper.className = 'kebab-menu';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kebab-btn';
  btn.textContent = '⋮';
  btn.setAttribute('aria-label', 'More actions');

  const dropdown = document.createElement('div');
  dropdown.className = 'kebab-dropdown';
  dropdown.hidden = true;

  actions.forEach((action) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `kebab-item${action.destructive ? ' destructive' : ''}`;
    item.textContent = action.label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.hidden = true;
      closeOpenKebabMenu = null;
      action.onClick();
    });
    dropdown.appendChild(item);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.hidden;
    if (closeOpenKebabMenu) closeOpenKebabMenu();
    if (!isOpen) {
      dropdown.hidden = false;
      closeOpenKebabMenu = () => {
        dropdown.hidden = true;
      };
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);
  return wrapper;
}

document.addEventListener('click', () => {
  if (closeOpenKebabMenu) {
    closeOpenKebabMenu();
    closeOpenKebabMenu = null;
  }
});

function renderConversationRow(c) {
  const row = document.createElement('div');
  row.className = 'conversation-row';

  const item = document.createElement('div');
  item.className = `conversation-item${c.id === currentConversationId ? ' active' : ''}`;
  item.textContent = c.title;
  item.title = c.title;
  item.addEventListener('click', () => switchConversation(c.id));

  function startRename() {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-rename-input';
    input.value = c.title;

    function commit() {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== c.title) {
        c.title = newTitle;
        saveConversations();
      }
      renderConversationList();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        renderConversationList();
      }
    });
    input.addEventListener('blur', commit);
    input.addEventListener('click', (e) => e.stopPropagation());

    row.replaceChild(input, item);
    input.focus();
    input.select();
  }

  const menu = createKebabMenu([
    { label: 'Rename', onClick: startRename },
    {
      label: 'Delete',
      destructive: true,
      onClick: () => {
        if (window.confirm(`Delete conversation "${c.title}"? This cannot be undone.`)) {
          deleteConversation(c.id);
        }
      }
    }
  ]);

  row.appendChild(item);
  row.appendChild(menu);
  return row;
}

function renderProjectGroup(project) {
  const group = document.createElement('div');
  group.className = 'project-group';

  const header = document.createElement('div');
  header.className = 'project-header';

  const chevron = document.createElement('span');
  chevron.className = 'project-chevron';
  chevron.textContent = project.isCollapsed ? '▸' : '▾';

  const name = document.createElement('span');
  name.className = 'project-name';
  name.textContent = project.name;
  name.title = project.name;

  const actions = document.createElement('div');
  actions.className = 'project-actions';

  const backgroundBox = document.createElement('textarea');
  backgroundBox.className = 'project-summary-editor';
  backgroundBox.placeholder = 'Project background (manual, long-lived context for chats in this project)...';
  backgroundBox.value = project.projectBackground || '';
  backgroundBox.hidden = true;
  backgroundBox.addEventListener('input', () => {
    project.projectBackground = backgroundBox.value;
    saveProjects();
  });

  const newChatInProjectBtn = document.createElement('button');
  newChatInProjectBtn.type = 'button';
  newChatInProjectBtn.className = 'project-action-btn';
  newChatInProjectBtn.title = 'New chat in this project';
  newChatInProjectBtn.textContent = '+';
  newChatInProjectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startNewChatInProject(project.id);
  });

  const editBackgroundBtn = document.createElement('button');
  editBackgroundBtn.type = 'button';
  editBackgroundBtn.className = 'project-action-btn';
  editBackgroundBtn.title = 'Edit project background';
  editBackgroundBtn.textContent = '✎';
  editBackgroundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    backgroundBox.hidden = !backgroundBox.hidden;
  });

  function startRenameProject() {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-rename-input';
    input.value = project.name;

    function commit() {
      const newName = input.value.trim();
      if (newName && newName !== project.name) {
        project.name = newName;
        saveProjects();
      }
      renderConversationList();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        renderConversationList();
      }
    });
    input.addEventListener('blur', commit);
    input.addEventListener('click', (e) => e.stopPropagation());

    header.replaceChild(input, name);
    input.focus();
    input.select();
  }

  const projectMenu = createKebabMenu([
    { label: 'Rename', onClick: startRenameProject },
    {
      label: 'Delete',
      destructive: true,
      onClick: () => {
        const count = conversations.filter((c) => c.projectId === project.id).length;
        const warning = count > 0
          ? `Delete project "${project.name}"? This will permanently delete all ${count} conversation${count === 1 ? '' : 's'} inside it, including their messages, summaries, and highlights. This cannot be undone.`
          : `Delete project "${project.name}"? This cannot be undone.`;
        if (window.confirm(warning)) {
          deleteProject(project.id);
        }
      }
    }
  ]);

  actions.appendChild(newChatInProjectBtn);
  actions.appendChild(editBackgroundBtn);
  actions.appendChild(projectMenu);
  header.appendChild(chevron);
  header.appendChild(name);
  header.appendChild(actions);

  header.addEventListener('click', () => {
    project.isCollapsed = !project.isCollapsed;
    saveProjects();
    renderConversationList();
  });

  const convosContainer = document.createElement('div');
  convosContainer.className = 'project-conversations';
  convosContainer.hidden = project.isCollapsed;
  conversations
    .filter((c) => c.projectId === project.id)
    .forEach((c) => convosContainer.appendChild(renderConversationRow(c)));

  group.appendChild(header);
  group.appendChild(backgroundBox);
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
    const otherChatsHeader = document.createElement('div');
    otherChatsHeader.className = 'other-chats-header';

    const chevron = document.createElement('span');
    chevron.className = 'project-chevron';
    chevron.textContent = uiState.otherChatsCollapsed ? '▸' : '▾';

    const label = document.createElement('span');
    label.className = 'conversation-group-label';
    label.textContent = 'Other chats';

    otherChatsHeader.appendChild(chevron);
    otherChatsHeader.appendChild(label);
    otherChatsHeader.addEventListener('click', () => {
      uiState.otherChatsCollapsed = !uiState.otherChatsCollapsed;
      saveUiState();
      renderConversationList();
    });

    conversationList.appendChild(otherChatsHeader);

    const otherChatsList = document.createElement('div');
    otherChatsList.className = 'other-chats-list';
    otherChatsList.hidden = uiState.otherChatsCollapsed;
    unassigned.forEach((c) => otherChatsList.appendChild(renderConversationRow(c)));
    conversationList.appendChild(otherChatsList);
  } else {
    unassigned.forEach((c) => conversationList.appendChild(renderConversationRow(c)));
  }
}

function renderChatLog(conversation) {
  chatLog.innerHTML = '';
  if (!conversation) return;
  conversation.messages.forEach((m) => addMessage(m.text, m.role));
}

function switchConversation(id) {
  if (id === currentConversationId) return;
  closeBtwPanel();
  currentConversationId = id;
  renderChatLog(getCurrentConversation());
  renderConversationList();
  renderHighlights();
  sidebar.classList.remove('open');
}

function startNewChat() {
  closeBtwPanel();
  currentConversationId = null;
  draftProjectId = null;
  chatLog.innerHTML = '';
  renderConversationList();
  renderHighlights();
  sidebar.classList.remove('open');
  textarea.focus();
}

function startNewChatInProject(projectId) {
  closeBtwPanel();
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
    return {
      summary: '',
      recentTurns: [],
      toSummarize: [],
      highlights: [],
      foldPoint: 0,
      projectBackground: '',
      projectRollingSummary: '',
      hasProject: false,
      conversationTitle: ''
    };
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
  const projectBackground = project ? (project.projectBackground || '') : '';
  const projectRollingSummary = project ? (project.projectRollingSummary || '') : '';

  return {
    summary: conversation.summary || '',
    recentTurns,
    toSummarize,
    highlights,
    foldPoint,
    projectBackground,
    projectRollingSummary,
    hasProject: !!project,
    conversationTitle: conversation.title
  };
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
        projectBackground: context.projectBackground,
        projectRollingSummary: context.projectRollingSummary,
        hasProject: context.hasProject,
        conversationTitle: context.conversationTitle,
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

        // Project rolling summary only advances when the conversation-level fold fires.
        if (conversation.projectId && context.toSummarize.length > 0) {
          const project = getProjectById(conversation.projectId);
          if (project) {
            project.projectRollingSummary = data.projectRollingSummary || project.projectRollingSummary || '';
            saveProjects();
          }
        }
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
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Shift+Enter is left to the browser's default behavior, which inserts a newline in a textarea.
});

// ---- BTW (temporary side-chat about one specific response) ----
//
// Strictly isolated from main conversation memory: btwState lives only in this
// module's memory, is never persisted to localStorage, and is never written into
// conversation.messages, conversation.summary, summarizedCount, highlights, or
// projectRollingSummary. It never touches persistMessage() or saveConversations().

const btwBackdrop = document.getElementById('btw-backdrop');
const btwPanel = document.getElementById('btw-panel');
const btwTurnsEl = document.getElementById('btw-turns');
const btwForm = document.getElementById('btw-form');
const btwInput = document.getElementById('btw-input');
const btwClose = document.getElementById('btw-close');
const btwSendButton = btwForm.querySelector('button');

let btwState = null; // null when the panel is closed; { anchorText, turns: [{role, text}] } when open

function renderBtwTurns() {
  btwTurnsEl.innerHTML = '';
  if (!btwState) return;

  btwState.turns.forEach((t) => {
    const row = document.createElement('div');
    row.className = `btw-turn-row ${t.role}`;

    const bubble = document.createElement('div');
    bubble.className = 'btw-turn-bubble';
    bubble.textContent = t.text;

    row.appendChild(bubble);
    btwTurnsEl.appendChild(row);
  });

  btwTurnsEl.scrollTop = btwTurnsEl.scrollHeight;
}

function openBtwPanel(responseText) {
  btwState = { anchorText: responseText, turns: [] };
  renderBtwTurns();
  btwBackdrop.hidden = false;
  btwPanel.hidden = false;
  btwInput.value = '';
  btwInput.focus();
}

function closeBtwPanel() {
  btwState = null;
  btwBackdrop.hidden = true;
  btwPanel.hidden = true;
  btwTurnsEl.innerHTML = '';
  btwInput.value = '';
}

btwBackdrop.addEventListener('click', closeBtwPanel);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && btwState) {
    closeBtwPanel();
  }
});

btwInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    sendBtwMessage();
  }
  // Plain Enter is left to the browser's default behavior, which inserts a newline.
});

function buildBtwRequestContext() {
  const conversation = getCurrentConversation();
  if (!conversation) {
    return { projectBackground: '', projectRollingSummary: '', summary: '' };
  }

  const project = conversation.projectId ? getProjectById(conversation.projectId) : null;

  return {
    projectBackground: project ? (project.projectBackground || '') : '',
    projectRollingSummary: project ? (project.projectRollingSummary || '') : '',
    summary: conversation.summary || ''
  };
}

async function sendBtwMessage() {
  if (!btwState) return;

  const question = btwInput.value.trim();
  if (!question) return;

  // Prior turns only — the question itself is sent as a separate field.
  const priorBtwTurns = btwState.turns.map((t) => ({
    role: t.role === 'user' ? 'user' : 'assistant',
    content: t.text
  }));

  btwState.turns.push({ role: 'user', text: question });
  renderBtwTurns();
  btwInput.value = '';
  btwSendButton.disabled = true;

  btwState.turns.push({ role: 'assistant', text: 'Thinking...' });
  renderBtwTurns();

  const context = buildBtwRequestContext();

  try {
    const response = await fetch('/api/btw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        projectBackground: context.projectBackground,
        projectRollingSummary: context.projectRollingSummary,
        summary: context.summary,
        anchorText: btwState.anchorText,
        btwTurns: priorBtwTurns
      })
    });

    const data = await response.json();

    if (!btwState) return; // panel was closed while the request was in flight

    btwState.turns.pop(); // remove "Thinking..." placeholder

    if (!response.ok) {
      btwState.turns.push({ role: 'assistant', text: data.error || 'Something went wrong.' });
    } else {
      btwState.turns.push({ role: 'assistant', text: data.answer });
    }
    renderBtwTurns();
  } catch (err) {
    if (!btwState) return;
    btwState.turns.pop();
    btwState.turns.push({ role: 'assistant', text: 'Could not reach the server.' });
    renderBtwTurns();
  } finally {
    if (btwState) btwSendButton.disabled = false;
    btwInput.focus();
  }
}

btwForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendBtwMessage();
});

btwClose.addEventListener('click', closeBtwPanel);

// ---- Highlights (scoped per conversation) ----

// Highlights used to be stored globally across all conversations; that data is stale
// now that each conversation owns its own highlights, so drop it.
localStorage.removeItem('chatlab-highlights');

const highlightsPanel = document.getElementById('highlights-panel');
const highlightsToggle = document.getElementById('highlights-toggle');
const highlightsClose = document.getElementById('highlights-close');
const highlightsPanelTitle = document.getElementById('highlights-panel-title');
const highlightsList = document.getElementById('highlights-list');
const highlightCountEl = document.getElementById('highlight-count');
const generateNoteBtn = document.getElementById('generate-note-btn');
const generateNoteLabel = document.getElementById('generate-note-label');
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

  if (highlightsPanelTitle) {
    highlightsPanelTitle.textContent = highlights.length > 0
      ? `Highlights · ${highlights.length}`
      : 'Highlights';
  }

  if (generateNoteLabel) {
    generateNoteLabel.textContent = highlights.length > 0
      ? `Generate Note · ${highlights.length} highlight${highlights.length === 1 ? '' : 's'}`
      : 'Generate Note';
  }
  generateNoteBtn.disabled = highlights.length === 0;

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

    const dragHandle = document.createElement('span');
    dragHandle.className = 'highlight-drag-handle';
    dragHandle.setAttribute('aria-hidden', 'true');
    dragHandle.textContent = '⋮⋮';

    const metaRight = document.createElement('div');
    metaRight.className = 'highlight-meta-right';

    const time = document.createElement('span');
    time.textContent = formatTimestamp(h.timestamp);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'highlight-remove';
    removeBtn.setAttribute('aria-label', 'Remove highlight');
    removeBtn.title = 'Remove highlight';
    removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    removeBtn.addEventListener('click', () => {
      conversation.highlights = conversation.highlights.filter((x) => x.id !== h.id);
      saveHighlights();
      renderHighlights();
    });

    metaRight.appendChild(time);
    metaRight.appendChild(removeBtn);
    meta.appendChild(dragHandle);
    meta.appendChild(metaRight);

    item.appendChild(quote);
    item.appendChild(note);
    item.appendChild(meta);
    highlightsList.appendChild(item);
  });
}

function addHighlight(text, meta) {
  const conversation = getCurrentConversation();
  if (!conversation) return;

  const source = (meta && meta.source) || 'main';

  const highlight = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    note: '',
    timestamp: new Date().toISOString(),
    source
  };

  if (source === 'btw' && meta && meta.anchorAssistantText) {
    highlight.anchorAssistantText = meta.anchorAssistantText;
  }

  conversation.highlights.push(highlight);
  saveHighlights();
  renderHighlights();
  highlightsPanel.classList.add('open');
}

// Returns 'main', 'btw', or null depending on whether the given selection node sits
// inside a highlightable assistant response (main chat bot bubble, or a BTW assistant
// turn bubble). User-authored text is never highlightable in either context.
function getHighlightSourceFromNode(node) {
  const el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!el || !el.closest) return null;

  const mainBubble = el.closest('.bubble');
  if (mainBubble) {
    const row = mainBubble.closest('.message-row');
    if (row && row.classList.contains('bot') && !row.classList.contains('pending')) {
      return 'main';
    }
    return null;
  }

  const btwBubble = el.closest('.btw-turn-bubble');
  if (btwBubble) {
    const row = btwBubble.closest('.btw-turn-row');
    if (row && row.classList.contains('assistant')) {
      return 'btw';
    }
    return null;
  }

  return null;
}

function hideSelectionPopup() {
  selectionPopup.hidden = true;
  delete selectionPopup.dataset.text;
  delete selectionPopup.dataset.source;
}

function showSelectionPopup(rect, text, source) {
  // Inside the BTW modal, the native OS/browser selection toolbar tends to appear
  // just above the selection — place our popup below it instead so it stays visible.
  const top = source === 'btw'
    ? Math.min(rect.bottom + 10, window.innerHeight - 40)
    : Math.max(rect.top - 40, 8);
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - 110);
  selectionPopup.style.top = `${top}px`;
  selectionPopup.style.left = `${left}px`;
  selectionPopup.dataset.text = text;
  selectionPopup.dataset.source = source;
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

    const source = getHighlightSourceFromNode(selection.anchorNode);
    if (!source) {
      hideSelectionPopup();
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    showSelectionPopup(rect, text, source);
  }, 0);
});

selectionPopup.addEventListener('mousedown', (e) => {
  e.preventDefault();
});

selectionPopup.addEventListener('click', () => {
  const text = selectionPopup.dataset.text;
  const source = selectionPopup.dataset.source;
  if (text) {
    if (source === 'btw' && btwState) {
      addHighlight(text, { source: 'btw', anchorAssistantText: btwState.anchorText });
    } else {
      addHighlight(text, { source: 'main' });
    }
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
