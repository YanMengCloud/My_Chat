class MessageSearchManager {
    constructor() {
        this.modal = new bootstrap.Modal(document.getElementById('searchHistoryModal'));
        this.searchInput = document.getElementById('historySearchInput');
        this.searchButton = document.getElementById('searchHistoryBtn');
        this.resultsContainer = document.getElementById('searchHistoryResults');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 搜索按钮点击事件
        this.searchButton.addEventListener('click', () => this.performSearch());
        
        // 输入框回车事件
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch();
            }
        });
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        if (!state.currentConversation) {
            showError('请先选择一个会话');
            return;
        }

        try {
            const response = await fetch(`/api/conversations/${state.currentConversation._id}/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'X-XSRFToken': getCookie('_xsrf')
                }
            });

            if (!response.ok) {
                throw new Error('搜索失败');
            }

            const data = await response.json();
            this.displayResults(data.messages);
        } catch (error) {
            console.error('搜索失败:', error);
            showError('搜索失败');
        }
    }

    displayResults(messages) {
        if (!messages || messages.length === 0) {
            this.resultsContainer.innerHTML = '<div class="text-center text-muted p-3">没有找到匹配的消息</div>';
            return;
        }

        this.resultsContainer.innerHTML = messages.map(message => `
            <div class="search-result-item ${message.role}">
                <div class="header">
                    <span class="role">${message.role === 'user' ? '用户' : 'AI助手'}</span>
                    <span class="timestamp">${formatTimestamp(message.created_at)}</span>
                </div>
                <div class="content">${marked.parse(message.content)}</div>
            </div>
        `).join('');

        // 处理代码块的高亮
        this.resultsContainer.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    }

    show() {
        this.searchInput.value = '';
        this.resultsContainer.innerHTML = '';
        this.modal.show();
        this.searchInput.focus();
    }
}

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 创建搜索管理器实例
    const messageSearchManager = new MessageSearchManager();

    // 绑定搜索按钮点击事件
    const searchMessagesBtn = document.getElementById('searchMessagesBtn');
    if (searchMessagesBtn) {
        searchMessagesBtn.addEventListener('click', () => {
            messageSearchManager.show();
        });
    }
});