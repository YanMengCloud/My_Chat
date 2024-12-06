document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // 获取XSRF令牌
    function getCookie(name) {
        const r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
        return r ? r[1] : undefined;
    }

    // 处理表单提交
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // 验证表单
        if (!loginForm.checkValidity()) {
            e.stopPropagation();
            loginForm.classList.add('was-validated');
            return;
        }

        try {
            // 获取表单数据
            const formData = {
                username: document.getElementById('username').value,
                password: passwordInput.value
            };

            // 发送登录请求
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRFToken': getCookie("_xsrf")
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // 登录成功，跳转到主页
                window.location.href = '/';
            } else {
                // 显示错误信息
                loginError.textContent = data.error || '登录失败';
                loginError.classList.remove('d-none');
            }
        } catch (error) {
            console.error('登录失败:', error);
            loginError.textContent = '登录失败，请稍后重试';
            loginError.classList.remove('d-none');
        }
    });

    // 切换密码显示/隐藏
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    });

    // 输入时隐藏错误信息
    loginForm.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', function() {
            loginError.classList.add('d-none');
        });
    });

    // 检查是否已登录
    checkLoginStatus();
});

// 检查登录状态
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/auth', {
            headers: {
                'X-XSRFToken': getCookie("_xsrf")
            }
        });
        const data = await response.json();

        if (response.ok && data.user) {
            // 已登录，跳转到主页
            window.location.href = '/';
        }
    } catch (error) {
        console.error('检查登录状态失败:', error);
    }
} 