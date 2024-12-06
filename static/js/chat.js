// 全局状态
const state = {
    currentConversation: null,
    models: [],
    conversations: [],
    messageLoadingState: {
        page: 1,
        loading: false,
        hasMore: true,
        pageSize: 10,
        totalCount: 0,
        loadedMessages: new Set() // 用于跟踪已加载的消息ID
    },
    ws: null,  // WebSocket连接
    currentAiMessage: null,  // 当前AI消息元素
    currentContent: '',  // 当前消息内容
};

// 工具函数
function showError(message) {
    console.error(message);
    const alertsContainer = document.getElementById('alertsContainer');
    if (alertsContainer) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        alertsContainer.appendChild(alert);
        
        // 5秒后自动关闭
        setTimeout(() => {
            if (alert.parentElement) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }
}

function getCookie(name) {
    let r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}

// 格式化时间戳
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    // 检查是否是字符串类型的ISO时间格式
    if (typeof timestamp === 'string' && timestamp.includes('T')) {
        timestamp = new Date(timestamp).getTime();
    }
    
    // 检查是否需要乘以1000（秒转毫秒）
    if (timestamp < 10000000000) {
        timestamp *= 1000;
    }
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        return '';
    }
    
    const now = new Date();
    const diff = now - date;
    const locale = navigator.language || 'zh-CN';
    
    // 如果是今天的消息
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
    
    // 如果是昨天的消息
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && 
        date.getMonth() === yesterday.getMonth() && 
        date.getFullYear() === yesterday.getFullYear()) {
        return `昨天 ${date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })}`;
    }
    
    // 如果是今年的消息
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleString(locale, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
    
    // 其他情况显示完整日期
    return date.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// 加载会话列表
async function loadConversations() {
    try {
        console.log('加载会话列表...');
        const response = await fetch('/api/conversations', {
            headers: {
                'X-XSRFToken': getCookie('_xsrf')
            }
        });

        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }

        const data = await response.json();
        console.log('获取到会话列表:', data);

        // 更新会话列表
        const conversationsList = document.getElementById('conversationsList');
        if (conversationsList) {
            conversationsList.innerHTML = '';
            if (data.conversations && data.conversations.length > 0) {
                // 按最后消息时间排序
                data.conversations.sort((a, b) => {
                    let aTime = a.last_message_at || a.updated_at || a.created_at;
                    let bTime = b.last_message_at || b.updated_at || b.created_at;
                    
                    // 处理 MongoDB 格式的时间戳
                    if (aTime && typeof aTime === 'object' && aTime.$date) {
                        aTime = aTime.$date;
                    }
                    if (bTime && typeof bTime === 'object' && bTime.$date) {
                        bTime = bTime.$date;
                    }
                    
                    // 转换为时间戳进行比较
                    const aTimestamp = new Date(aTime).getTime();
                    const bTimestamp = new Date(bTime).getTime();
                    
                    return bTimestamp - aTimestamp; // 降序排序
                });

                // 更新本地状态中的会话列表
                state.conversations = data.conversations;

                data.conversations.forEach(conversation => {
                    const item = document.createElement('div');
                    item.className = 'conversation-item';
                    item.dataset.id = conversation._id;

                    // 检查是否是当前会话
                    if (state.currentConversation && state.currentConversation._id === conversation._id) {
                        item.classList.add('active');
                        // 更新当前会话的信息
                        state.currentConversation = conversation;
                    }
                    
                    // 获取最后更新时间
                    let lastTime = conversation.last_message_at || conversation.updated_at || conversation.created_at;
                    
                    // 处理 MongoDB 格式的时间戳
                    if (lastTime && typeof lastTime === 'object' && lastTime.$date) {
                        lastTime = lastTime.$date;
                    }
                    
                    item.innerHTML = `
                        <div class="conversation-title">${conversation.title}</div>
                        <div class="conversation-info">
                            <span class="model-name">${conversation.model_name || ''}</span>
                            <span class="timestamp">${formatTimestamp(lastTime)}</span>
                        </div>
                    `;
                    item.onclick = () => switchConversation(conversation._id);
                    conversationsList.appendChild(item);
                });

                console.log('会话列表更新完成，当前会话:', state.currentConversation);
            } else {
                conversationsList.innerHTML = '<div class="no-conversations">暂无会话</div>';
            }
        }
    } catch (error) {
        console.error('加载会话列表失败:', error);
        showError('加载会话列表失败: ' + error.message);
    }
}

// 重置聊天界面
function resetChatUI() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="chat-welcome">
                <div class="icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h2>欢迎使用 My Chat</h2>
                <p>选择一个现有会话开始聊天，或者创建一个新的会话。AI 助手将帮助你解答问题、编写代码、分析数据等。</p>
                <div class="actions">
                    <button class="btn btn-primary" onclick="showNewConversationModal()">
                        <i class="fas fa-plus"></i> 新建会话
                    </button>
                </div>
            </div>
        `;
    }

    // 隐藏操作按钮
    const chatActions = document.querySelector('.chat-actions');
    if (chatActions) {
        chatActions.style.display = 'none';
    }

    // 禁用相关按钮和输入框
    const editPromptBtn = document.getElementById('editPromptBtn');
    const deleteConversationBtn = document.getElementById('deleteConversationBtn');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');

    if (editPromptBtn) editPromptBtn.disabled = true;
    if (deleteConversationBtn) deleteConversationBtn.disabled = true;
    if (messageInput) messageInput.disabled = true;
    if (sendMessageBtn) sendMessageBtn.disabled = true;

    // 清空标题和提示词
    const titleElement = document.getElementById('currentConversationTitle');
    const promptElement = document.getElementById('currentConversationPrompt');

    if (titleElement) titleElement.textContent = '请选择或创建会话';
    if (promptElement) promptElement.textContent = '';
}

// 切换会话
async function switchConversation(conversationId) {
    try {
        if (!conversationId) {
            showError('会话ID不能为空');
            return;
        }

        console.log('切换到会话:', conversationId);
        const response = await fetch(`/api/conversations/${conversationId}`, {
            headers: {
                'X-XSRFToken': getCookie('_xsrf')
            }
        });

        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }

        const data = await response.json();
        if (!data.conversation) {
            throw new Error('返回的会话数据无效');
        }

        console.log('获取到会话详情:', data);

        // 更新状态
        state.currentConversation = data.conversation;

        // 显示操作按钮
        const chatActions = document.querySelector('.chat-actions');
        if (chatActions) {
            chatActions.style.display = 'flex';
        }

        // 更新UI
        const titleElement = document.getElementById('currentConversationTitle');
        const promptElement = document.getElementById('currentConversationPrompt');
        const editPromptBtn = document.getElementById('editPromptBtn');
        const deleteConversationBtn = document.getElementById('deleteConversationBtn');
        const messageInput = document.getElementById('messageInput');
        const sendMessageBtn = document.getElementById('sendMessageBtn');

        if (titleElement) {
            titleElement.textContent = data.conversation.title || '未名会话';
        }
        if (promptElement) {
            promptElement.textContent = data.conversation.system_prompt || '';
        }
        
        // 更新模型选择
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect && data.conversation.model_id) {
            modelSelect.value = data.conversation.model_id;
        }
        
        // 启用相关按钮
        if (editPromptBtn) editPromptBtn.disabled = false;
        if (deleteConversationBtn) deleteConversationBtn.disabled = false;
        if (messageInput) messageInput.disabled = false;
        if (sendMessageBtn) sendMessageBtn.disabled = false;

        // 更新会话列表中的活动状态
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => {
            item.classList.remove('active');
            const titleDiv = item.querySelector('.conversation-title');
            if (titleDiv && titleDiv.textContent === data.conversation.title) {
                item.classList.add('active');
            }
        });

        // 加载会话消息
        await loadMessages(conversationId);
    } catch (error) {
        console.error('切换会话失败:', error);
        showError('切换会话失败: ' + error.message);
    }
}

// 插入建议问题到输入框并发送
function insertSuggestion(element) {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = element.textContent.trim();
        messageInput.focus();
        // 自动发送消息
        sendMessage();
    }
}

// 加载会话消息
async function loadMessages(conversationId, reset = true) {
    try {
        if (!conversationId) {
            showError('会话ID不能为空');
            return;
        }

        if (reset) {
            // 重置加载状态
            state.messageLoadingState = {
                page: 1,
                loading: false,
                hasMore: true,
                pageSize: 10,
                totalCount: 0,
                loadedMessages: new Set()
            };
            // 清空消息区域
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
        }

        // 如果正在加载或没有更多消息，直接返回
        if (state.messageLoadingState.loading || !state.messageLoadingState.hasMore) {
            return;
        }

        state.messageLoadingState.loading = true;
        console.log('加载会话消息:', conversationId, '页码:', state.messageLoadingState.page);

        // 如果是第一次加载，先添加历史记录结束提示
        if (state.messageLoadingState.page === 1) {
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                const endIndicator = document.createElement('div');
                endIndicator.className = 'history-end-indicator';
                endIndicator.textContent = '以上是全部历史记录';
                messagesContainer.appendChild(endIndicator);
            }
        }

        const response = await fetch(
            `/api/conversations/${conversationId}/messages?page=${state.messageLoadingState.page}&page_size=${state.messageLoadingState.pageSize}`, 
            {
                headers: {
                    'X-XSRFToken': getCookie('_xsrf')
                }
            }
        );

        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }

        const data = await response.json();
        console.log('获取到会话消息:', data);

        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        if (data.messages && data.messages.length > 0) {
            // 过滤掉已加载的消息
            const newMessages = data.messages.filter(msg => !state.messageLoadingState.loadedMessages.has(msg._id));
            
            if (newMessages.length === 0) {
                console.log('所有消息已加载');
                state.messageLoadingState.hasMore = false;
                return;
            }

            // 按时间正序排列消息
            const sortedMessages = [...newMessages].sort((a, b) => 
                new Date(a.created_at) - new Date(b.created_at)
            );
            
            // 添加消息
            sortedMessages.forEach(message => {
                if (!state.messageLoadingState.loadedMessages.has(message._id)) {
                    addMessageToChat(message, null, true);
                    state.messageLoadingState.loadedMessages.add(message._id);
                    state.messageLoadingState.totalCount++;
                }
            });

            // 更新加载状态
            state.messageLoadingState.page += 1;
            state.messageLoadingState.hasMore = data.messages.length >= state.messageLoadingState.pageSize;

            // 如果是第一页，滚动到部
            if (state.messageLoadingState.page === 2) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        } else {
            // 如果没有获取到任何消息
            state.messageLoadingState.hasMore = false;
            
            if (reset) {
                // 显示空消息提示
                messagesContainer.innerHTML = `
                    <div class="empty-messages">
                        <div class="icon">
                            <i class="fas fa-comments"></i>
                        </div>
                        <h4>开始新的对话</h4>
                        <p>这是一个新的会话。你可以问任何问题，我会尽力帮助你。</p>
                        <div class="suggestions">
                            <div class="suggestion-item" onclick="insertSuggestion(this)">
                                你能做什么？请介绍一下你的功能。
                            </div>
                            <div class="suggestion-item" onclick="insertSuggestion(this)">
                                请帮我写一段Python代码，实现冒泡排。
                            </div>
                            <div class="suggestion-item" onclick="insertSuggestion(this)">
                                解释一下什么是人工智能？
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('加载会话消息失败:', error);
        showError('加载会话消息失败: ' + error.message);
        state.messageLoadingState.hasMore = false;
    } finally {
        state.messageLoadingState.loading = false;
    }
}

// 固定的模型列表
// const AVAILABLE_MODELS = [
//     {
//         _id: "gpt-4",
//         name: "GPT-4",
//         owned_by: "openai"
//     },
//     {
//         _id: "gpt-4-32k",
//         name: "GPT-4-32K",
//         owned_by: "openai"
//     },
//     {
//         _id: "gpt-3.5-turbo",
//         name: "GPT-3.5 Turbo",
//         owned_by: "openai"
//     },
//     {
//         _id: "gpt-3.5-turbo-16k",
//         name: "GPT-3.5 Turbo-16K",
//         owned_by: "openai"
//     }
// ];

// // 更新模型选择下拉框
// function updateModelSelects() {
//     const modelSelects = document.querySelectorAll('#modelSelect, #editModelSelect');
//     modelSelects.forEach(select => {
//         if (!select) return;
        
//         // 保存当前选中的值
//         const currentValue = select.value;
        
//         // 空并添加选项
//         select.innerHTML = `
//             <option value="">请选择模型...</option>
//             ${AVAILABLE_MODELS.map(model => `
//                 <option value="${model._id}" ${currentValue === model._id ? 'selected' : ''}>
//                     ${model.name}
//                 </option>
//             `).join('')}
//         `;
//     });
// }

async function updateModelSelects() {
    try {
        // 从后端获取模型列表
        const response = await fetch('/api/models', {
            headers: {
                'X-XSRFToken': getCookie('_xsrf')
            }
        });

        if (!response.ok) {
            throw new Error(`获取模型列表失败: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !Array.isArray(data.models)) {
            throw new Error('返回的模型数据无效');
        }

        // 更新全局状态中的模型列表
        state.models = data.models;

        // 更新所有模型选择下拉框
    const modelSelects = document.querySelectorAll('#modelSelect, #editModelSelect');
    modelSelects.forEach(select => {
        if (!select) return;
        
        // 保存当前选中的值
        const currentValue = select.value;
        
            // 清空并添加选项
        select.innerHTML = `
            <option value="">请选择模型...</option>
                ${data.models.map(model => `
                    <option value="${model.id}" ${currentValue === model.id ? 'selected' : ''}>
                    ${model.name}
                </option>
            `).join('')}
        `;
    });
    } catch (error) {
        console.error('更新模型列表失败:', error);
        showError('更新模型列表失败: ' + error.message);
    }
}

// 初始化模态框
function initModals() {
    // 初始化新建会话模态框
    const newConversationModal = document.getElementById('newConversationModal');
    if (newConversationModal) {
        window.newConversationModal = new bootstrap.Modal(newConversationModal, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // 处理模态框事件
        newConversationModal.addEventListener('hidden.bs.modal', () => {
            // 移除 aria-hidden 属性
            newConversationModal.removeAttribute('aria-hidden');
            // 重置表单
            const form = document.getElementById('newConversationForm');
            if (form) form.reset();
            // 将焦点移回触发按钮
            const newConversationBtn = document.getElementById('newConversationBtn');
            if (newConversationBtn) {
                newConversationBtn.focus();
            }
        });
        
        newConversationModal.addEventListener('show.bs.modal', () => {
            // 确保模态框可以接收焦点
            newConversationModal.removeAttribute('aria-hidden');
            // 设置初始焦点
            setTimeout(() => {
                const titleInput = document.getElementById('conversationTitle');
                if (titleInput) titleInput.focus();
            }, 100);
        });
    }
    
    // 初始化编辑系统提示词模态框
    const editPromptModal = document.getElementById('editPromptModal');
    if (editPromptModal) {
        window.editPromptModal = new bootstrap.Modal(editPromptModal, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // 处理模态框事件
        editPromptModal.addEventListener('hidden.bs.modal', () => {
            // 移除 aria-hidden 属性
            editPromptModal.removeAttribute('aria-hidden');
            // 将焦点移回触发按钮
            const editPromptBtn = document.getElementById('editPromptBtn');
            if (editPromptBtn) {
                editPromptBtn.focus();
            }
        });
        
        editPromptModal.addEventListener('show.bs.modal', () => {
            // 确保模态框可以接收焦点
            editPromptModal.removeAttribute('aria-hidden');
            // 设置初始焦点
            setTimeout(() => {
                const modelSelect = document.getElementById('editModelSelect');
                if (modelSelect) modelSelect.focus();
            }, 100);
        });
    }
    
    // 处理取消按钮
    const cancelButtons = document.querySelectorAll('[data-bs-dismiss="modal"]');
    cancelButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // 阻止默认行为
            e.preventDefault();
            // 获取当前模态框
            const modal = button.closest('.modal');
            if (modal) {
                // 移除 aria-hidden 属性
                modal.removeAttribute('aria-hidden');
                // 先移除焦点，再关闭模态框
                button.blur();
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) {
                    modalInstance.hide();
                }
            }
        });
    });
}

// 绑定事件处理器
function bindEventHandlers() {
    // 发送消息
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await sendMessage();
        });
    }
    
    // 消息输入框
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // 自动调整高度
        messageInput.addEventListener('input', () => {
            adjustTextareaHeight(messageInput);
        });
        
        // 处理回车发送
        messageInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                await sendMessage();
            }
        });
    }
    
    // 新建会话按钮
    const newConversationBtn = document.getElementById('newConversationBtn');
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', () => {
            showNewConversationModal();
        });
    }
    
    // 创建会话按钮
    const createConversationBtn = document.getElementById('createConversationBtn');
    if (createConversationBtn) {
        createConversationBtn.addEventListener('click', async () => {
            await createNewConversation();
        });
    }
    
    // 编辑系统提示词按钮
    const editPromptBtn = document.getElementById('editPromptBtn');
    if (editPromptBtn) {
        editPromptBtn.addEventListener('click', () => {
            showEditPromptModal();
        });
    }
    
    // 保存系统提示词按钮
    const savePromptBtn = document.getElementById('savePromptBtn');
    if (savePromptBtn) {
        savePromptBtn.addEventListener('click', async () => {
            await updateConversationSettings();
        });
    }
    
    // 删除会话按钮
    const deleteConversationBtn = document.getElementById('deleteConversationBtn');
    if (deleteConversationBtn) {
        deleteConversationBtn.addEventListener('click', async () => {
            if (state.currentConversation) {
                await deleteConversation(state.currentConversation._id);
            }
        });
    }
    
    // 退出登录按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logout();
        });
    }

    // 会话搜索
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchConversations(e.target.value);
        });
        
        // 清空搜索
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                searchConversations('');
            });
        }
    }
}

// 调整输入框高度
function adjustTextareaHeight(textarea) {
    // 保存当前滚动位置
    const scrollPos = window.scrollY;
    
    // 重高度
    textarea.style.height = 'auto';
    
    // 计算新高度，但不超过最大高度
    const maxHeight = 200;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
    
    // 如果内容超过最大高度，启用滚动
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    
    // 恢复滚动位置
    window.scrollTo(0, scrollPos);
}

// 发送消息
async function sendMessage() {
    if (!state.currentConversation || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
        showError('无法发送消息，请稍后重试');
        return;
    }

    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    const sendButton = document.getElementById('sendMessageBtn');
    
    if (!content) return;

    try {
        // 禁用输入和发送按钮
        messageInput.disabled = true;
        if (sendButton) {
            sendButton.disabled = true;
        }

        // 清空输入框
        messageInput.value = '';
        adjustTextareaHeight(messageInput);

        // 创建用户消息
        const userMessage = {
            role: 'user',
            content: content,
            created_at: new Date().toISOString()
        };
        
        // 添加到界面
        addMessageToChat(userMessage, null, true);

        // 发送消息到WebSocket
        state.ws.send(JSON.stringify({
            conversation_id: state.currentConversation._id,
            content: content,
            role: 'user'
        }));

    } catch (error) {
        console.error('消息处理失败:', error);
        showError(error.message);
    } finally {
        // 恢复输入和发送按钮
        messageInput.disabled = false;
        messageInput.focus();
        if (sendButton) {
            sendButton.disabled = false;
        }
    }
}

// 修复模态框的可访问性问题
function fixModalAccessibility() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        // 移除 aria-hidden 属性
        modal.removeAttribute('aria-hidden');
        
        // 添加 inert 属性（当模态框关闭时）
        modal.addEventListener('hidden.bs.modal', () => {
            modal.setAttribute('inert', '');
        });
        
        // 移除 inert 属性（当模态框打开时）
        modal.addEventListener('shown.bs.modal', () => {
            modal.removeAttribute('inert');
        });
        
        // 确保焦点在模态框内循环
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const focusableElements = modal.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstFocusable = focusableElements[0];
                const lastFocusable = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    });
}

// 在初始化应用时调用
async function initializeApp() {
    try {
        console.log('初始化应用...');
        
        // 初始化模态框
        initModals();
        
        // 修复模态框的可访问性问题
        fixModalAccessibility();
        
        // 初始化WebSocket连接
        initWebSocket();
        
        // 初始化模型选择下拉框
        updateModelSelects();
        
        // 绑定事件处理器
        bindEventHandlers();
        
        // 加载会话列表
        console.log('加载会话列表...');
        await loadConversations();
        
        console.log('初始化完成');
    } catch (error) {
        console.error('初始化失败:', error);
        showError('初始化失败: ' + error.message);
    }
}

// =============== WebSocket 相关函数 ===============

// 初始化WebSocket连接
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket连接已建立');
        state.ws = ws;
    };
    
    ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        state.ws = null;
        // 尝试重新连接
        setTimeout(initWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        showError('WebSocket连接错误');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('处理WebSocket消息失败:', error);
        }
    };
}

// 处理WebSocket消息
function handleWebSocketMessage(data) {
    if (data.error) {
        showError(data.error);
        return;
    }
    
    switch (data.type) {
        case 'stream':
            // 处理流式内容
            if (!state.currentAiMessage) {
                // 创建新的AI消息元素
                state.currentAiMessage = addMessageToChat({
                    role: 'assistant',
                    content: '',
                    created_at: new Date().toISOString()
                }, null, true, true);
            }
            
            // 更新内容
            const contentElement = state.currentAiMessage.querySelector('.message-content');
            if (contentElement) {
                state.currentContent = (state.currentContent || '') + data.content;
                requestAnimationFrame(() => {
                    contentElement.innerHTML = marked.parse(state.currentContent, {
                        breaks: true,
                        gfm: true,
                        smartLists: true,
                        smartypants: true
                    })
                    .replace(/<p>\s*<\/p>/g, '')
                    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, '')
                    .replace(/\n+$/, '')
                    .replace(/<p><\/p>\n/g, '')
                    .replace(/\n{2,}/g, '\n')
                    .trim();
                    
                    // 高亮代码块
                    contentElement.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                    
                    // 滚动到底部
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                });
            }
            break;
            
        case 'done':
            // 处理完成的消息
            if (state.currentAiMessage) {
                state.currentAiMessage.classList.remove('streaming');
                if (data.message) {
                    state.currentAiMessage.dataset.id = data.message._id;
                    const timeElement = state.currentAiMessage.querySelector('.message-info');
                    if (timeElement) {
                        // 处理 MongoDB 格式的时间戳
                        if (data.message.created_at && typeof data.message.created_at === 'object' && data.message.created_at.$date) {
                            timeElement.textContent = formatTimestamp(data.message.created_at.$date);
                        }
                        // 处理 ISO 字符串格式的时间戳
                        else if (data.message.created_at && typeof data.message.created_at === 'string') {
                            timeElement.textContent = formatTimestamp(data.message.created_at);
                        }
                    }
                }
                // 清理状态
                state.currentAiMessage = null;
                state.currentContent = '';
            }

            // 刷新会话列表
            loadConversations().then(() => {
                // 确保当前会话保持选中状态
                if (state.currentConversation) {
                    const conversationItems = document.querySelectorAll('.conversation-item');
                    conversationItems.forEach(item => {
                        if (item.dataset.id === state.currentConversation._id) {
                            item.classList.add('active');
                        }
                    });
                }
            });
            
            break;


            
        default:
            console.warn('未知的消息类型:', data.type);
    }
}

// 更新系统提示词
async function updateSystemPrompt() {
    if (!state.currentConversation) return;
    
    const promptInput = document.getElementById('systemPrompt');
    const systemPrompt = promptInput.value.trim();
    
    try {
        const response = await fetch(`/api/conversations/${state.currentConversation._id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-XSRFToken': getCookie('_xsrf')
            },
            body: JSON.stringify({
                system_prompt: systemPrompt
            })
        });
        
        if (!response.ok) {
            throw new Error('更新系统提示词失败');
        }
        
        // 更新当前会话
        const conversation = await response.json();
        state.currentConversation = conversation;
        
        // 关闭模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('editPromptModal'));
        if (modal) {
            modal.hide();
        }
        
        showError('系统提示词已更新', 'success');
    } catch (error) {
        console.error('更新系统提示词失败:', error);
        showError(error.message);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);

// 监听消息容器的滚动事件
document.addEventListener('DOMContentLoaded', function() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.addEventListener('scroll', function() {
            if (!state.currentConversation) return;

            const scrollTop = messagesContainer.scrollTop;
            const scrollHeight = messagesContainer.scrollHeight;
            const clientHeight = messagesContainer.clientHeight;
            
            // 当滚动到顶部附近时加载更多消息
            if (scrollTop <= 100 && 
                !state.messageLoadingState.loading && 
                state.messageLoadingState.hasMore) {
                
                console.log('触发加载更多消息', {
                    scrollTop,
                    loading: state.messageLoadingState.loading,
                    hasMore: state.messageLoadingState.hasMore
                });

                // 记当前滚动位置
                const currentScrollHeight = scrollHeight;
                
                loadMessages(state.currentConversation._id, false).then(() => {
                    // 保持相对滚动位置
                    const newScrollHeight = messagesContainer.scrollHeight;
                    const scrollDiff = newScrollHeight - currentScrollHeight;
                    messagesContainer.scrollTop = scrollDiff;
                });
            }
        });
    }
});

// 显示新建会话模态框
function showNewConversationModal() {
    try {
        console.log('显示新建会话模态框');
        if (window.newConversationModal) {
            // 更新模型选择下拉框
            updateModelSelects();
            // 显示模态框
            window.newConversationModal.show();
        } else {
            throw new Error('模态框未初始化');
        }
    } catch (error) {
        console.error('显示新建会话模态框失败:', error);
        showError('显示新建会话模态框失败');
    }
}

// 创建新会话
async function createNewConversation() {
    try {
        const titleInput = document.getElementById('conversationTitle');
        const promptInput = document.getElementById('systemPrompt');
        const modelSelect = document.getElementById('modelSelect');
        
        if (!titleInput || !promptInput || !modelSelect) {
            throw new Error('找不到表单元素');
        }

        const title = titleInput.value.trim();
        const prompt = promptInput.value.trim();
        const modelId = modelSelect.value;

        if (!title) {
            showError('请输入会话标题');
            return;
        }

        if (!modelId) {
            showError('请选择模型');
            return;
        }

        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-XSRFToken': getCookie('_xsrf')
            },
            body: JSON.stringify({
                title: title,
                system_prompt: prompt,
                model_id: modelId
            })
        });

        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }

        const result = await response.json();
        console.log('创建会话成功:', result);

        // 关闭模态框
        if (window.newConversationModal) {
            window.newConversationModal.hide();
        }

        // 刷新会话列表
        await loadConversations();
        
        // 切换到新会话
        if (result.conversation && result.conversation._id) {
            await switchConversation(result.conversation._id);
        }
    } catch (error) {
        console.error('创建会话失败:', error);
        showError('创建会话失败: ' + error.message);
    }
}

// 添加消息到聊天界面
function addMessageToChat(message, container = null, appendToBottom = false, isStreaming = false) {
    const messagesContainer = container || document.getElementById('chatMessages');
    if (!messagesContainer) return;

    // 如果是空消息状态，先清除
    const emptyMessages = messagesContainer.querySelector('.empty-messages');
    if (emptyMessages) {
        messagesContainer.innerHTML = '';
    }

    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.role}`;
    if (isStreaming) {
        messageElement.classList.add('streaming');
    }
    
    // 处理消息内容（支持Markdown）
    const content = message.content?.trim() || '';
    const contentHtml = marked.parse(content, {
        breaks: true,
        gfm: true,
        smartLists: true,
        smartypants: true
    })
    .replace(/<p>\s*<\/p>/g, '') // 移除空段落
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, '') // 移除只包含换行的段落
    .replace(/\n+$/, '') // 移除末尾的换行符
    .replace(/<p><\/p>\n/g, '') // 移除段落之间的空行
    .replace(/\n{2,}/g, '\n') // 将多个连续换行符替换为单个
    .trim(); // 移除首尾空白

    console.log(message);

    // 格式化时间
    let timeStr = '';
    if (message.created_at) {
        // 处理 MongoDB 格式的时间戳
        if (typeof message.created_at === 'object' && message.created_at.$date) {
            timeStr = formatTimestamp(message.created_at.$date);
        } 
        // 处理 ISO 字符串格式的时间戳
        else if (typeof message.created_at === 'string') {
            timeStr = formatTimestamp(message.created_at);
        }
    }

    messageElement.innerHTML = `
        <div class="message-content">${contentHtml}</div>
        <div class="message-info">${timeStr}</div>
    `.trim();

    // 处理代码块的高亮
    messageElement.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
    });

    // 根据appendToBottom参数决定添加位置
    if (appendToBottom) {
        messagesContainer.appendChild(messageElement);
        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        if (messagesContainer.firstChild) {
            messagesContainer.insertBefore(messageElement, messagesContainer.firstChild);
        } else {
            messagesContainer.appendChild(messageElement);
        }
    }

    return messageElement;
}

// 显示编辑系统提示词模态框
function showEditPromptModal() {
    try {
        console.log('显示编辑会话设置模态框');
        if (!state.currentConversation) {
            showError('请先选择一个会话');
            return;
        }

        console.log('当前会话信息:', state.currentConversation);

        // 更新模型选择下拉框
        updateModelSelects();
        
        // 获取系统提示词和模型ID
        let systemPrompt = '';
        let modelId = '';

        // 检查model_id是否是对象
        if (state.currentConversation.model_id && typeof state.currentConversation.model_id === 'object') {
            systemPrompt = state.currentConversation.model_id.system_prompt || '';
            modelId = state.currentConversation.model_id.model_id || '';
        } else {
            systemPrompt = state.currentConversation.system_prompt || '';
            modelId = state.currentConversation.model_id || '';
        }

        console.log('设置模态框值:', { systemPrompt, modelId });
        
        // 设置系统提示词
        const promptInput = document.getElementById('editSystemPrompt');
        if (promptInput) {
            promptInput.value = systemPrompt;
        }
        
        // 设置当前模型
        const modelSelect = document.getElementById('editModelSelect');
        if (modelSelect) {
            modelSelect.value = modelId;
        }

        // 显示模态框
        if (window.editPromptModal) {
            window.editPromptModal.show();
        } else {
            throw new Error('编辑模态框未初始化');
        }
    } catch (error) {
        console.error('显示编辑会话设置模态框失败:', error);
        showError('显示编辑会话设置模态框失败');
    }
}


// 更新会话设置
async function updateConversationSettings() {
    try {
        if (!state.currentConversation) {
            showError('请先选择一个会话');
            return;
        }

        const modelSelect = document.getElementById('editModelSelect');
        const promptInput = document.getElementById('editSystemPrompt');
        
        if (!modelSelect || !promptInput) {
            showError('找不到表单元素');
            return;
        }

        const modelId = modelSelect.value;
        const systemPrompt = promptInput.value.trim();

        if (!modelId) {
            showError('请选择模型');
            return;
        }

        console.log('更新会话设置:', {
            modelId,
            systemPrompt,
            conversationId: state.currentConversation._id
        });

        // 禁用保存按钮，防止重复提交
        const saveButton = document.getElementById('savePromptBtn');
        if (saveButton) {
            saveButton.disabled = true;
        }

        try {
            // 发送更新请求
            const response = await fetch(`/api/conversations/${state.currentConversation._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRFToken': getCookie('_xsrf')
                },
                body: JSON.stringify({
                    model_id: modelId,
                    system_prompt: systemPrompt
                })
            });

            if (!response.ok) {
                throw new Error(`更新会话设置失败: ${response.status}`);
            }

            const result = await response.json();
            console.log('更新结果:', result);
            
            // 更新当前会话状态
            state.currentConversation = result.conversation;
            
            // 更新界面
            document.getElementById('currentConversationPrompt').textContent = systemPrompt || '';
            
            // 先移除焦点，再关闭模态框
            if (saveButton) {
                saveButton.blur();
            }
            
            // 关闭模态框
            if (window.editPromptModal) {
                window.editPromptModal.hide();
            }

            showError('会话设置已更新', 'success');
        } finally {
            // 恢复保存按钮
            if (saveButton) {
                saveButton.disabled = false;
            }
        }
    } catch (error) {
        console.error('更新会话设置失败:', error);
        showError(error.message);
    }
}

// 删除会话
async function deleteConversation(conversationId) {
    try {
        if (!conversationId) {
            showError('会话ID不能为空');
            return;
        }

        if (!confirm('确定要删除这个会话吗？此操作不可恢复。')) {
            return;
        }

        const response = await fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'X-XSRFToken': getCookie('_xsrf')
            }
        });

        if (!response.ok) {
            throw new Error(`删除会话失败: ${response.status}`);
        }

        // 如果删除的是当前会话，清除当前会话状态
        if (state.currentConversation && state.currentConversation._id === conversationId) {
            state.currentConversation = null;
            
            // 重置聊天界面
            resetChatUI();
        }

        // 刷新会话列表
        await loadConversations();

        showError('会话已删除', 'success');
    } catch (error) {
        console.error('删除会话失败:', error);
        showError(error.message);
    }
}

// 搜索会话
function searchConversations(query) {
    const conversationsList = document.getElementById('conversationsList');
    if (!conversationsList) return;

    const searchQuery = query.toLowerCase().trim();
    
    // 如果搜索框为空，显示所有会话
    if (!searchQuery) {
        const items = conversationsList.querySelectorAll('.conversation-item');
        items.forEach(item => {
            item.style.display = '';
        });
        return;
    }

    // 搜索会话
    const items = conversationsList.querySelectorAll('.conversation-item');
    items.forEach(item => {
        const title = item.querySelector('.conversation-title')?.textContent?.toLowerCase() || '';
        const modelName = item.querySelector('.model-name')?.textContent?.toLowerCase() || '';
        
        if (title.includes(searchQuery) || modelName.includes(searchQuery)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

