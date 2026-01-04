"use strict";

const connection = new signalR.HubConnectionBuilder()
  .withUrl("/chatHub", {
    accessTokenFactory: () => localStorage.getItem('token')
  })
  .withAutomaticReconnect()
  .build();

let currentChatType = 'direct'; // 'direct' or 'project'
let currentChatId = null;
let currentChatName = null;

const chatTab = document.getElementById('chat-tab');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatSubtitle = document.getElementById('chat-subtitle');
const chatWithName = document.getElementById('chat-with-name');
const chatSidebar = document.getElementById('chat-sidebar');
const chatUserList = document.getElementById('chat-user-list');
const btnBackToUsers = document.getElementById('btn-back-to-users');
const chatSidebarChatMembersBtn = document.getElementById('sidebar-chat-members-btn');
const chatSidebarChatProjectsBtn = document.getElementById('sidebar-chat-projects-btn');

// --- SignalR Events ---

connection.on("ReceiveMessage", function (message) {
  console.log("Msg received:", message);

  const currentUserId = localStorage.getItem('user_id') || localStorage.getItem('user_email');

  // Multi-tab sync & Deduplication: 
  // If we already have this message (by ID), don't append it again.
  if (message.id && document.getElementById(`msg-${message.id}`)) return;

  const isMe = message.senderId === currentUserId;

  // Optimistic replacement:
  // If we just sent this, we might have an optimistic bubble with no ID.
  if (isMe) {
    const optimisticDiv = document.querySelector('.message-row.is-me.is-optimistic');
    if (optimisticDiv && !message.id) return; // Wait for real ID
    if (optimisticDiv && message.id) {
      // Update the optimistic bubble with the real ID
      optimisticDiv.id = `msg-${message.id}`;
      optimisticDiv.classList.remove('is-optimistic');
      const trashBtn = optimisticDiv.querySelector('.action-btn');
      if (trashBtn) {
        trashBtn.onclick = () => deleteMessage(message.id);
      }
      console.log("Optimistic message upgraded with ID:", message.id);
      return; // Don't append a new one
    }
  }

  let shouldAppend = false;

  if (chatTab.classList.contains('active')) {
    if (currentChatType === 'direct') {
      // Check if message is direct and from/to current user
      if (message.type === 0 && (message.senderId === currentChatId || (isMe && currentChatId === currentUserId))) {
        shouldAppend = true;
      }
    } else if (currentChatType === 'project') {
      // Check if message is for current project
      if (message.type === 1 && message.projectId.toString() === currentChatId) {
        shouldAppend = true;
      }
    }
  }

  if (shouldAppend) {
    appendMessage(message);
    scrollToBottom();
  } else if (!isMe) {
    // Show notification/badge
    showToast(`Nouveau message de ${message.senderName}`, 'info');
  }
});

connection.start().then(function () {
  console.log("SignalR Connected!");
}).catch(function (err) {
  return console.error(err.toString());
});

// --- UI Logic ---

// Sidebar integration - Internal Toggle Buttons
const btnShowMembers = document.getElementById('btn-show-members');
const btnShowProjects = document.getElementById('btn-show-projects');

if (btnShowMembers) {
  btnShowMembers.addEventListener('click', () => {
    btnShowMembers.classList.add('active');
    btnShowProjects.classList.remove('active');
    loadChatUsers('members');
  });
}

if (btnShowProjects) {
  btnShowProjects.addEventListener('click', () => {
    btnShowProjects.classList.add('active');
    btnShowMembers.classList.remove('active');
    loadChatUsers('projects');
  });
}

// Main Navigation Buttons (Sidebar)
if (chatSidebarChatMembersBtn) {
  chatSidebarChatMembersBtn.addEventListener('click', () => {
    // Switch to tab is handled by app.js logic for .tab-btn, but we need to set the internal state
    if (btnShowMembers) btnShowMembers.click(); // Trigger internal logic
  });
}

if (chatSidebarChatProjectsBtn) {
  chatSidebarChatProjectsBtn.addEventListener('click', () => {
    if (btnShowProjects) btnShowProjects.click(); // Trigger internal logic
  });
}

// Back to Users List
if (btnBackToUsers) {
  btnBackToUsers.addEventListener('click', () => {
    chatSidebar.classList.add('active');
  });
}

// Send Message
window.sendMessage = async function () {
  const message = chatInput.value.trim();
  if (!message || !currentChatId) return;

  // Optimistic UI: clear input and show message immediately
  const myName = localStorage.getItem('user_name') || 'Moi';
  const optimisticMsg = {
    senderId: localStorage.getItem('user_id'),
    senderName: myName,
    content: message,
    sentAt: new Date().toISOString(),
    isOptimistic: true
  };
  appendMessage(optimisticMsg);
  scrollToBottom();

  chatInput.value = '';

  try {
    if (currentChatType === 'direct') {
      await connection.invoke("SendMessageToUser", currentChatId, message);
    } else {
      await connection.invoke("SendMessageToProject", parseInt(currentChatId), message);
    }
    // Success - input already cleared
  } catch (err) {
    console.error(err);
    showToast(`Erreur d'envoi: ${err.message || err}`, "error");
  }
}

if (chatSendBtn) {
  chatSendBtn.addEventListener('click', sendMessage);
}

if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

// Load Users or Projects
function loadChatUsers(type = 'members') {
  chatUserList.innerHTML = '';

  if (type === 'members') {
    const members = window.currentData ? window.currentData.members : [];
    console.log("Chat members loaded:", members);
    members.forEach(member => {
      const el = document.createElement('div');
      el.className = 'conv-item';
      el.innerHTML = `
                <div class="avatar" style="width: 32px; height: 32px; font-size: 0.8rem;">
                    ${getInitials(member.name)}
                </div>
                <div class="conv-info">
                    <div class="conv-name">${member.name}</div>
                    <div class="conv-last-msg">${member.role}</div>
                </div>
            `;
      el.addEventListener('click', () => openConversation(member, 'direct'));
      chatUserList.appendChild(el);
    });
  } else {
    const projects = window.currentData ? window.currentData.projects : [];
    projects.forEach(project => {
      const el = document.createElement('div');
      el.className = 'conv-item';
      el.innerHTML = `
                <div class="avatar" style="width: 32px; height: 32px; font-size: 0.8rem; background:var(--primary); color:white;">
                    📁
                </div>
                <div class="conv-info">
                    <div class="conv-name">${project.name}</div>
                    <div class="conv-last-msg">Conversation de groupe</div>
                </div>
            `;
      el.addEventListener('click', () => openConversation(project, 'project'));
      chatUserList.appendChild(el);
    });
  }
}

// Open Conversation
async function openConversation(item, type) {
  const oldChatType = currentChatType;
  const oldChatId = currentChatId;

  currentChatType = type;
  // Use userId if available (preferred), fallback to email/id
  if (type === 'direct') {
    currentChatId = item.userId || item.email;
  } else {
    currentChatId = item.id.toString();
  }
  if (chatWithName) chatWithName.textContent = item.name;
  const headerAvatar = document.getElementById('chat-header-avatar');
  if (headerAvatar) {
    headerAvatar.textContent = getInitials(item.name);
    headerAvatar.style.backgroundColor = type === 'direct' ? 'var(--primary)' : 'var(--secondary)';
  }

  // Show UI elements
  const chatHeader = document.getElementById('chat-header');
  const chatInputArea = document.getElementById('chat-input-area');
  if (chatHeader) chatHeader.style.display = 'block';
  if (chatInputArea) chatInputArea.style.display = 'flex';

  chatSidebar.classList.remove('active');
  chatMessages.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">Chargement...</div>';

  // SignalR Group handling for projects
  if (type === 'project') {
    await connection.invoke("JoinProject", parseInt(currentChatId));
  }
  // Leave previous project group if any
  if (oldChatType === 'project' && oldChatId && oldChatId !== currentChatId) {
    await connection.invoke("LeaveProject", parseInt(oldChatId));
  }

  // Load History
  const endpoint = type === 'direct' ? `direct/${currentChatId}` : `project/${currentChatId}`;
  try {
    const res = await fetch(`${API_BASE}/Chat/${endpoint}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const messages = await res.json();
      renderMessages(messages);
    } else {
      chatMessages.innerHTML = '<div style="text-align:center; padding:20px;">Aucun message</div>';
    }
  } catch (e) {
    console.error(e);
    chatMessages.innerHTML = '<div style="text-align:center; color:red">Erreur chargement</div>';
  }
}

// Global helper to open project chat from anywhere
window.openProjectChat = function (projectId) {
  const project = window.currentData.projects.find(p => p.id === projectId);
  if (!project) return;

  // Ensure chat tab is active
  switchToTab('chat');

  // Switch to projects tab and open conversation
  if (chatSidebarChatProjectsBtn) chatSidebarChatProjectsBtn.click();
  openConversation(project, 'project');
};


function renderMessages(messages) {
  chatMessages.innerHTML = '';
  messages.forEach(appendMessage);
  scrollToBottom();
}

function appendMessage(msg) {
  // Check if we can group this message with previous one (same sender, < 5 min diff) - Advanced feature for later.
  // For now, render full row every time.

  // Get Avatar initials
  const initials = getInitials(msg.senderName);

  // Time format
  const time = new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // Maybe add "Today at" logic later

  const currentUserId = localStorage.getItem('user_id') || localStorage.getItem('user_email');
  const isMe = msg.senderId === currentUserId;

  const div = document.createElement('div');
  div.className = `message-row ${isMe ? 'is-me' : 'is-other'} ${msg.isOptimistic ? 'is-optimistic' : ''}`;

  // Minimal bubble structure
  div.innerHTML = `
        ${!isMe ? `
        <div class="avatar" title="${msg.senderName}" style="display:flex; align-items:center; justify-content:center; background-color: var(--primary); color:white; font-size: 0.85rem;">
            ${initials}
        </div>` : ''}
        
        <div class="message-bubble">
            ${!isMe ? `<div class="message-sender-name">${msg.senderName}</div>` : ''}
            <div class="message-text">${msg.content}</div>
            <div class="message-time">${time}</div>
        </div>

        ${isMe ? `
        <div class="message-actions">
            ${(new Date() - new Date(msg.sentAt)) < 3600000 ? `
            <button class="action-btn" onclick="deleteMessage(${msg.id})" title="Supprimer">🗑️</button>
            ` : ''}
        </div>` : ''}
    `;
  div.id = `msg-${msg.id}`; // Add ID for deletion lookup
  chatMessages.appendChild(div);
}

// Global scope for onclick
window.deleteMessage = async function (id) {
  if (!confirm("Supprimer ce message ?")) return;
  try {
    await connection.invoke("DeleteMessage", parseInt(id));
    // Removal will be handled by "MessageDeleted" event for real-time sync
  } catch (e) {
    console.error(e);
    const errorMsg = e.message || "";
    if (errorMsg.includes("1 hour")) {
      showToast("Impossible : message de plus d'une heure", "error");
    } else {
      showToast("Erreur lors de la suppression", "error");
    }
  }
};

connection.on("MessageDeleted", function (id) {
  const el = document.getElementById(`msg-${id}`);
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300); // Smooth fade out
  }
});


function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}
