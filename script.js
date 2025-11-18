const WORKER_URL = 'https://gemini-api-proxy.markd-voznyuk.workers.dev';

let chats = [];
let currentChatId = null;
let settings = {
    userName: 'User',
    userAvatar: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%2334d399\'/%3E%3Ctext x=\'50\' y=\'50\' font-size=\'40\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\'%3EU%3C/text%3E%3C/svg%3E',
    borderRadius: 18,
    userAge: '',
    userHobby: '',
    userBio: ''
};

function loadFromCookie() {
    const data = getCookie('fhomeai_data');
    if (data) {
        try {
            const parsed = JSON.parse(data);
            chats = parsed.chats || [];
            settings = {...settings, ...parsed.settings};
            applySettings();
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
}

function saveToCookie() {
    const data = JSON.stringify({ chats, settings });
    setCookie('fhomeai_data', data, 365);
}

function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

function applySettings() {
    const userNameInput = document.getElementById('userNameInput');
    if (userNameInput) userNameInput.value = settings.userName;
    
    const userAvatarInput = document.getElementById('userAvatarInput');
    if (userAvatarInput) userAvatarInput.value = settings.userAvatar || '';
    
    const radiusSlider = document.getElementById('radiusSlider');
    if (radiusSlider) radiusSlider.value = settings.borderRadius;
    
    const radiusValue = document.getElementById('radiusValue');
    if (radiusValue) radiusValue.textContent = settings.borderRadius;
    
    document.getElementById('userAgeInput').value = settings.userAge || '';
    document.getElementById('userHobbyInput').value = settings.userHobby || '';
    document.getElementById('userBioInput').value = settings.userBio || '';
    
    const style = document.createElement('style');
    style.id = 'dynamic-radius';
    style.textContent = `.message-content { border-radius: ${settings.borderRadius}px !important; }`;
    const old = document.getElementById('dynamic-radius');
    if (old) old.remove();
    document.head.appendChild(style);
    
    const avatarInput = settings.userAvatar || '';
    if (avatarInput.indexOf('http') === 0) {
        const preview = document.getElementById('avatarPreview');
        if (preview) {
            preview.src = avatarInput;
            preview.style.display = 'block';
        }
    }
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('active');
}

function closeSettings() {
    settings.userName = document.getElementById('userNameInput').value || 'User';
    settings.userAvatar = document.getElementById('userAvatarInput').value || settings.userAvatar;
    settings.borderRadius = parseInt(document.getElementById('radiusSlider').value);
    settings.userAge = document.getElementById('userAgeInput').value || '';
    settings.userHobby = document.getElementById('userHobbyInput').value || '';
    settings.userBio = document.getElementById('userBioInput').value || '';
    applySettings();
    saveToCookie();
    renderMessages();
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('active');
}

function createNewChat() {
    const chat = {
        id: Date.now(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
    };
    chats.unshift(chat);
    currentChatId = chat.id;
    saveToCookie();
    renderChats();
    renderMessages();
}

function selectChat(chatId) {
    currentChatId = chatId;
    renderChats();
    renderMessages();
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function deleteChat(chatId, event) {
    event.stopPropagation();
    if (confirm('Delete this chat?')) {
        chats = chats.filter(c => c.id !== chatId);
        if (currentChatId === chatId) {
            currentChatId = chats.length > 0 ? chats[0].id : null;
        }
        saveToCookie();
        renderChats();
        renderMessages();
    }
}

function renameChat(chatId, event) {
    event.stopPropagation();
    const chat = chats.find(c => c.id === chatId);
    const newTitle = prompt('Enter new chat title:', chat.title);
    if (newTitle && newTitle.trim()) {
        chat.title = newTitle.trim();
        saveToCookie();
        renderChats();
    }
}

function renderChats() {
    const list = document.getElementById('chatsList');
    if (!list) return;
    list.innerHTML = chats.map(chat => `
        <div class="chat-item ${chat.id === currentChatId ? 'active' : ''}" onclick="selectChat(${chat.id})">
            <span class="chat-title">${chat.title}</span>
            <div class="chat-actions">
                <button class="chat-action-btn" onclick="renameChat(${chat.id}, event)" title="Rename">✏️</button>
                <button class="chat-action-btn" onclick="deleteChat(${chat.id}, event)" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    const chat = chats.find(c => c.id === currentChatId);
    const chatHeader = document.getElementById('chatHeader');
    
    if (!chat || chat.messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⌘</div>
                <div class="empty-state-title">Welcome to FHome AI</div>
                <div class="empty-state-text">Your intelligent assistant powered by advanced AI. Ask me anything and I'll help you find answers!</div>
            </div>
        `;
        if (chatHeader) chatHeader.textContent = chat ? chat.title : 'New Chat';
        return;
    }
    if (chatHeader) chatHeader.textContent = chat.title;
    
    container.innerHTML = chat.messages.map(msg => `
        <div class="message ${msg.role}">
            <img src="${msg.role === 'user' ? settings.userAvatar : 'icon.png'}" 
                 class="message-avatar" 
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%232ea67d\'/%3E%3Ctext x=\'50\' y=\'50\' font-size=\'40\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\'%3E${msg.role === 'user' ? 'U' : 'F'}%3C/text%3E%3C/svg%3E'">
            <div class="message-content">${msg.content}</div>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const message = input.value.trim();
    
    if (!message) return;
    if (!currentChatId) {
        createNewChat();
    }
    const chat = chats.find(c => c.id === currentChatId);
    
    chat.messages.push({ role: 'user', content: message });
    
    if (chat.messages.length === 1) {
        chat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
    }
    
    input.value = '';
    renderChats();
    renderMessages();
    const container = document.getElementById('messagesContainer');
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message ai';
    typingIndicator.innerHTML = `
        <img src="icon.png" class="message-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%232ea67d\'/%3E%3Ctext x=\'50\' y=\'50\' font-size=\'40\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\'%3EF%3C/text%3E%3C/svg%3E'">
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    container.appendChild(typingIndicator);
    container.scrollTop = container.scrollHeight;
    if (sendBtn) sendBtn.disabled = true;
    
    try {
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: chat.messages,
                settings: settings
            })
        });

        const data = await response.json();
        typingIndicator.remove();

        if (data.candidates && data.candidates[0]) {
            const aiMessage = data.candidates[0].content.parts[0].text;
            chat.messages.push({ role: 'ai', content: aiMessage });
        } else if (data.error) {
            let errorMessage = `AI Response Error: ${data.error.message || JSON.stringify(data)}`;
            chat.messages.push({ role: 'ai', content: `Sorry, I encountered an error processing your request. Details: ${errorMessage}` });
        } else {
            chat.messages.push({ role: 'ai', content: 'Sorry, I encountered an error processing your request (AI response failed).' });
        }
        
        saveToCookie();
        renderMessages();
    } catch (error) {
        typingIndicator.remove();
        chat.messages.push({ role: 'ai', content: `Sorry, I couldn't connect to the AI service. Details: ${error.message}` });
        renderMessages();
    }
    
    if (sendBtn) sendBtn.disabled = false;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('active');

    if (sidebar.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

document.addEventListener('click', function(e){
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.toggle-sidebar-btn');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
            sidebar.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const radiusSlider = document.getElementById('radiusSlider');
    if (radiusSlider) {
        radiusSlider.oninput = function() {
            const radiusValue = document.getElementById('radiusValue');
            if (radiusValue) radiusValue.textContent = this.value;
        };
    }
    
    const userAvatarInput = document.getElementById('userAvatarInput');
    if (userAvatarInput) {
        userAvatarInput.oninput = function() {
            const preview = document.getElementById('avatarPreview');
            const value = this.value || '';
            if (preview) {
                if (value && value.indexOf('http') === 0) {
                    preview.src = value;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                }
            }
        };
    }
    
    loadFromCookie();
    renderChats();
    renderMessages();
    
    if (chats.length === 0) {
        createNewChat();
    }
});

window.selectChat = selectChat;
window.deleteChat = deleteChat;
window.renameChat = renameChat;
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.toggleSidebar = toggleSidebar;
