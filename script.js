const WORKER_URL = 'https://gemini-api-proxy.markd-voznyuk.workers.dev';
const DAILY_LIMIT = 50;

let chats = [];
let currentChatId = null;
let settings = {
    userName: 'User',
    userAvatar: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%2334d399\'/%3E%3Ctext x=\'50\' y=\'50\' font-size=\'40\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\'%3EU%3C/text%3E%3C/svg%3E',
    borderRadius: 18,
    userAge: '',
    userHobby: '',
    userBio: '',
    userPreferences: ''
};

const uiOriginal = {
    buttonText: null,
    placeholder: null
};

function loadDailyData() {
    const data = JSON.parse(localStorage.getItem("dailyMessageData")) || {
        lastReset: null,
        count: 0
    };

    const now = Date.now();

    if (!data.lastReset || (now - data.lastReset >= 24 * 60 * 60 * 1000)) {
        data.lastReset = now;
        data.count = 0;
        localStorage.setItem("dailyMessageData", JSON.stringify(data));
    }

    return data;
}

function canSendDaily() {
    const data = loadDailyData();
    return data.count < DAILY_LIMIT;
}

function increaseDailyCounter() {
    const data = loadDailyData();
    data.count++;
    if (!data.lastReset) {
        data.lastReset = Date.now();
    }
    localStorage.setItem("dailyMessageData", JSON.stringify(data));
}

function getTimeUntilReset() {
    const data = loadDailyData();
    const now = Date.now();
    const resetTime = data.lastReset + 24 * 60 * 60 * 1000;
    let diff = Math.floor((resetTime - now) / 1000);

    if (diff < 0) diff = 0;

    const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
    diff %= 3600;
    const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
    const seconds = String(diff % 60).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}

function updateDailyUI() {
    const data = loadDailyData();
    const sendBtn = document.getElementById("sendBtn");
    const input = document.getElementById("messageInput");

    if (uiOriginal.buttonText === null) {
        uiOriginal.buttonText = sendBtn.textContent;
        uiOriginal.placeholder = input.placeholder;
    }

    if (data.count < DAILY_LIMIT) {
        sendBtn.disabled = false;
        sendBtn.textContent = uiOriginal.buttonText;
        input.placeholder = uiOriginal.placeholder;
        return;
    }

    sendBtn.disabled = true;

    const timeLeft = getTimeUntilReset();
    sendBtn.textContent = "✖";
    input.placeholder = `Daily limit reached — wait ${timeLeft}`;
}

function escapeHTML(str) {
    return str.replace(/[&<>"'\/]/g, function (c) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#47;'
        })[c];
    });
}

setInterval(() => {
    updateDailyUI();
    if (typeof updateMessageLimitUI === "function") updateMessageLimitUI();
}, 1000);

function copyCode(button) {
    const codeBlock = button.closest('.code-block-container').querySelector('pre code');
    if (!codeBlock) return;

    const textToCopy = codeBlock.innerText.trim();
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 1500);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 1500);
    });
}

function parseMarkdownSafe(text) {
    if (!text) return "";

    const codeBlockRegex = /```(\w*)\n([\s\S]+?)```/g;
    let parts = text.split(codeBlockRegex);
    let html = '';

    for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 1) {
            continue;
        } else if (i % 3 === 2) {
            const language = parts[i - 1].trim().toLowerCase() || 'text';
            const codeContent = parts[i];
            
            const cleanCode = codeContent.replace(/<br>/g, '\n');

            html += `
                <div class="code-block-container">
                    <div class="code-header">
                        <span class="code-language">${language}</span>
                        <button class="copy-btn" onclick="window.copyCode(this)">Copy</button>
                    </div>
                    <pre><code class="language-${language}">${escapeHTML(cleanCode)}</code></pre>
                </div>
            `;
        } else {
            let content = parts[i];
            
            content = escapeHTML(content);

            html += content
                .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/gs, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
        }
    }

    return html;
}

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

    const userPreferencesInput = document.getElementById('userPreferencesInput');
    if (userPreferencesInput) userPreferencesInput.value = settings.userPreferences || '';
    
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
    settings.userPreferences = document.getElementById('userPreferencesInput').value || '';
    applySettings();
    saveToCookie();
    renderMessages();
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('active');
}

function openChatManager() {
    const managerModal = document.getElementById('chatManagerModal');
    if (managerModal) managerModal.classList.add('active');
    renderChatManagerChats();
}

function closeChatManager() {
    const managerModal = document.getElementById('chatManagerModal');
    if (managerModal) managerModal.classList.remove('active');
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
    renderChatManagerChats();
}

function selectChat(chatId) {
    currentChatId = chatId;
    renderChats();
    renderMessages();
    renderChatManagerChats();
    closeChatManager();
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function deleteChat(chatId, event) {
    if (event) event.stopPropagation();
    if (confirm('Delete this chat?')) {
        chats = chats.filter(c => c.id !== chatId);
        if (currentChatId === chatId) {
            currentChatId = chats.length > 0 ? chats[0].id : null;
        }
        saveToCookie();
        renderChats();
        renderMessages();
        renderChatManagerChats();
    }
}

function renameChat(chatId, event) {
    if (event) event.stopPropagation();
    const chat = chats.find(c => c.id === chatId);
    const newTitle = prompt('Enter new chat title:', chat.title);
    if (newTitle && newTitle.trim()) {
        chat.title = newTitle.trim();
        saveToCookie();
        renderChats();
        renderMessages();
        renderChatManagerChats();
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

function renderChatManagerChats() {
    const managerList = document.getElementById('chatManagerChatsList');
    if (!managerList) return;
    managerList.innerHTML = chats.map(chat => `
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
    const chatHeaderTitle = document.getElementById('chatHeader').querySelector('.chat-title-mobile') || document.getElementById('chatHeader');
    
    if (!chat || chat.messages.length === 0) {
        if (!container.querySelector('.empty-state')) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⌘</div>
                    <div class="empty-state-title">Welcome to FHome AI</div>
                    <div class="empty-state-text">Your intelligent assistant powered by advanced AI. Ask me anything and I'll help you find answers!</div>
                </div>
            `;
        }
        if (chatHeaderTitle) chatHeaderTitle.textContent = chat ? chat.title : 'New Chat';
        return;
    }
    
    if (chatHeaderTitle) chatHeaderTitle.textContent = chat.title;
    
    container.innerHTML = chat.messages.map(msg => `
        <div class="message ${msg.role}">
            <img src="${msg.role === 'user' ? settings.userAvatar : 'icon.png'}" 
                 class="message-avatar" 
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%232ea67d\'/%3E%3Ctext x=\'50\' y=\'50\' font-size=\'40\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\'%3EF%3C/text%3E%3C/svg%3E'">
            <div class="message-content">${parseMarkdownSafe(msg.content)}</div>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

const MODES = ['mind', 'dev', 'teacher', 'short'];
let activeMode = null;
let tooltipTimeout;

function syncModeUI() {
    const input = document.getElementById("messageInput");
    const modeMatch = input.value.trim().match(/^\/(\w+)\b/);
    const currentMode = modeMatch ? modeMatch[1] : null;

    document.querySelectorAll('.mode-btn').forEach(btn => {
        const btnMode = btn.dataset.mode;
        btn.classList.toggle('active', btnMode === currentMode);
    });
}

function setMode(mode) {
    const input = document.getElementById("messageInput");
    const modeMatch = input.value.trim().match(/^\/(\w+)\b/);
    const currentModeName = modeMatch ? modeMatch[1] : null;

    let newMode = null;
    let cleanText = input.value.replace(/^\/\w+\s*/, "").trim();

    if (currentModeName === mode) {
        newMode = null;
    } else {
        newMode = mode;
    }

    if (newMode) {
        input.value = `/${newMode} ${cleanText}`.trim();
    } else {
        input.value = cleanText.trim();
    }

    input.focus();
    input.selectionStart = input.selectionEnd = input.value.length;
    
    syncModeUI();
}

function prepareMessageForAI() {
    let message = document.getElementById("messageInput").value.trim();

    const modeMatch = message.match(/^\/(\w+)\b\s*/);
    let modePrefix = '';

    if (modeMatch && MODES.includes(modeMatch[1])) {
        modePrefix = modeMatch[0];
        var cleanUserText = message.substring(modePrefix.length).trim();
    } else {
        cleanUserText = message;
    }
    
    const uiMessage = cleanUserText || message;
    
    const aiMessage = message;

    return { uiMessage, aiMessage };
}

function updateMessageLimitUI() {
    updateDailyUI();
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!input || !sendBtn) return;

if (!canSendDaily()) {
    updateDailyUI();
    return;
}

    const prepared = prepareMessageForAI();
    const uiMessage = prepared.uiMessage;
    const aiMessage = prepared.aiMessage;

    if (!aiMessage.trim()) return;

    if (!currentChatId) {
        createNewChat();
    }

    const chat = chats.find(c => c.id === currentChatId);

    chat.messages.push({ role: 'user', content: uiMessage });

    if (chat.messages.length === 1) {
        chat.title = uiMessage.substring(0, 30) + (uiMessage.length > 30 ? '...' : '');
    }

    input.value = '';
    syncModeUI();
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
    sendBtn.disabled = true;

    try {
increaseDailyCounter();
updateDailyUI();

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
            const aiMessageContent = data.candidates[0].content.parts[0].text;
            chat.messages.push({ role: 'ai', content: aiMessageContent });
        } else if (data.error) {
            const errorMessage = `AI Response Error: ${data.error.message || JSON.stringify(data)}`;
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

}
function handleKeyPress(event) {
    const input = document.getElementById('messageInput');
    if (event.key === 'Enter') {
        if (event.shiftKey) {
            const cursorPos = input.selectionStart;
            const text = input.value;
            input.value = text.slice(0, cursorPos) + "\n" + text.slice(cursorPos);
            input.selectionStart = input.selectionEnd = cursorPos + 1;
        } else {
            event.preventDefault();
            sendMessage();
        }
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
    const chatManagerModal = document.getElementById('chatManagerModal');
    
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
            sidebar.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    if (chatManagerModal && chatManagerModal.classList.contains('active') && !chatManagerModal.querySelector('.modal-content').contains(e.target) && !toggleBtn.contains(e.target)) {
        closeChatManager();
    }
    
    if (document.getElementById('tooltip') && document.getElementById('tooltip').style.display === 'block') {
        hideTooltip();
    }
});

function getTooltipText(mode) {
    switch (mode) {
        case "mind": return "Deep thinking mode. For complex and detailed analysis.";
        case "dev": return "Developer-only coding mode. Focuses on code and technical solutions.";
        case "teacher": return "Explain concepts simply. Uses clear language and analogies.";
        case "short": return "Short minimal answers. Concise and direct replies.";
        default: return "";
    }
}

function showTooltip(element, text) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    tooltip.textContent = text;
    tooltip.style.display = 'block';

    const rect = element.getBoundingClientRect();
    const inputArea = element.closest('.input-area') || document.body;
    const inputAreaRect = inputArea.getBoundingClientRect();
    
    const leftOffset = rect.left - inputAreaRect.left + rect.width / 2 - tooltip.offsetWidth / 2;
    const topOffset = rect.top - inputAreaRect.top - tooltip.offsetHeight - 10;
    
    tooltip.style.left = `${leftOffset}px`;
    tooltip.style.top = `${topOffset}px`;
    
    if (tooltip.offsetLeft + tooltip.offsetWidth > inputAreaRect.width - 10) {
        tooltip.style.left = `${inputAreaRect.width - tooltip.offsetWidth - 10}px`; 
    }
    if (tooltip.offsetLeft < 10) {
        tooltip.style.left = '10px'; 
    }
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
        clearTimeout(tooltipTimeout);
    }
}

function manageMobileSettingsButton() {
    const headerSettingsBtn = document.querySelector('.header-settings-btn');
    if (!headerSettingsBtn) return;
    
    const textSpan = headerSettingsBtn.querySelector('span');
    if (textSpan) {
        if (window.innerWidth <= 768) {
            textSpan.style.display = 'none';
        } else {
            textSpan.style.display = '';
        }
    }
}

function setupMobileUI() {
    const chatHeader = document.getElementById('chatHeader');
    if (!chatHeader) return;

    const fabNewChat = document.querySelector('.fab-new-chat');
    if (fabNewChat) {
        fabNewChat.style.display = 'none';
    }

    if (!chatHeader.querySelector('.chat-title-mobile')) {
        const titleEl = document.createElement('div');
        titleEl.className = 'chat-title-mobile';
        titleEl.textContent = chatHeader.textContent || 'New Chat'; 
        const toggleBtn = chatHeader.querySelector('.toggle-sidebar-btn');
        chatHeader.innerHTML = '';
        if (toggleBtn) chatHeader.appendChild(toggleBtn);
        chatHeader.appendChild(titleEl);
    }

    if (!chatHeader.querySelector('.header-settings-btn')) {
        const origSettings = document.querySelector('.settings-btn');
        if (origSettings) {
            const clone = origSettings.cloneNode(true);
            clone.classList.remove('settings-btn');
            clone.classList.add('header-settings-btn');
            
            clone.onclick = function(e) {
                e.stopPropagation();
                openSettings();
            };
            
            if (!clone.querySelector('span')) {
                const icon = clone.innerHTML;
                clone.innerHTML = `${icon} <span>Settings</span>`;
            }
            
            chatHeader.appendChild(clone);
            manageMobileSettingsButton();
        }
    }
}

function refreshMobileHeaderTitle() {
    const chatHeader = document.getElementById('chatHeader');
    const titleEl = chatHeader ? chatHeader.querySelector('.chat-title-mobile') : null;
    const chat = chats.find(c => c.id === currentChatId);
    if (titleEl) titleEl.textContent = chat ? chat.title : 'New Chat';
}

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

setupMobileUI();
refreshMobileHeaderTitle();

const mobileChatBtn = document.querySelector('.chat-header .toggle-sidebar-btn');
if (mobileChatBtn) {
    mobileChatBtn.addEventListener('click', openChatModal);
}

window.addEventListener('resize', manageMobileSettingsButton);

const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', syncModeUI);
        messageInput.addEventListener('keydown', handleKeyPress);
    }

    document.querySelectorAll('.mode-btn').forEach(btn => {
        const mode = btn.dataset.mode;
        
        btn.addEventListener('click', () => {
            setMode(mode);
            
            if (window.innerWidth <= 768) {
                hideTooltip();
                showTooltip(btn, getTooltipText(mode));
                tooltipTimeout = setTimeout(hideTooltip, 3000);
            }
        });

        btn.addEventListener('mouseenter', e => {
            if (window.innerWidth > 768) {
                tooltipTimeout = setTimeout(() => {
                    showTooltip(btn, getTooltipText(mode));
                }, 1500);
            }
        });
        
        btn.addEventListener('mouseleave', () => {
            if (window.innerWidth > 768) {
                clearTimeout(tooltipTimeout);
                hideTooltip();
            }
        });
    });
    
    syncModeUI();
    
    const toggleSidebarBtn = document.querySelector('.chat-header .toggle-sidebar-btn');
        if (toggleSidebarBtn) {
        toggleSidebarBtn.onclick = openChatModal;
       }
});

function openChatModal() {
    const modal = document.getElementById('chatModal');
    modal.classList.add('active');

    const modalList = document.getElementById('chatModalList');
    modalList.innerHTML = '';

    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-title';
        titleSpan.textContent = chat.title;
        chatItem.appendChild(titleSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'chat-actions';
        actionsDiv.style.opacity = 1;

        const renameBtn = document.createElement('button');
        renameBtn.className = 'chat-action-btn';
        renameBtn.textContent = '✏️';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameChat(chat.id);
            refreshChatModal();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-action-btn';
        deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
            refreshChatModal();
        });

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        chatItem.appendChild(actionsDiv);

        chatItem.addEventListener('click', () => {
            selectChat(chat.id);
            closeChatModal();
        });

        modalList.appendChild(chatItem);
    });
}

function refreshChatModal() {
    if (document.getElementById('chatModal')?.classList.contains('active')) {
        openChatModal();
    }
}

function closeChatModal() {
    const modal = document.getElementById('chatModal');
    modal.classList.remove('active');
}

document.getElementById('chatModal').addEventListener('click', (e) => {
    if (e.target.id === 'chatModal') {
        closeChatModal();
    }
});

function createNewChatFromHeader() {
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
    refreshMobileHeaderTitle();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('ServiceWorker registered', reg))
      .catch(err => console.log('ServiceWorker registration failed', err));
  });
}

(function(){
    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-JGT0TXWH5W";
    document.head.appendChild(gaScript);

    gaScript.onload = function() {
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', 'G-JGT0TXWH5W');
    };
})();

window.selectChat = selectChat;
window.deleteChat = deleteChat;
window.renameChat = renameChat;
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.toggleSidebar = toggleSidebar;
window.copyCode = copyCode;
window.createNewChat = createNewChat;
window.openChatManager = openChatManager;
window.closeChatManager = closeChatManager;
