// 基础工具函数
function getCookie(name) {
    let r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}

// 显示提示消息
function showError(message, type = 'danger') {
    console.error(message);
    const alertsContainer = document.getElementById('alertsContainer');
    if (alertsContainer) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
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

// 退出登录
async function logout() {
    try {
        const response = await fetch('/api/auth', {
            method: 'DELETE',
            headers: {
                'X-XSRFToken': getCookie('_xsrf')
            }
        });

        if (!response.ok) {
            throw new Error(`退出登录失败: ${response.status}`);
        }

        // 清除本地状态
        if (typeof state !== 'undefined') {
            state.currentConversation = null;
            state.ws?.close();
            state.ws = null;
        }

        // 重定向到登录页面
        window.location.href = '/login';
    } catch (error) {
        console.error('退出登录失败:', error);
        showError('退出登录失败: ' + error.message);
        // 即使出错也尝试重定向到登录页面
        window.location.href = '/login';
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

// 调整输入框高度
function adjustTextareaHeight(textarea) {
    // 保存当前滚动位置
    const scrollPos = window.scrollY;
    
    // 重置高度
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