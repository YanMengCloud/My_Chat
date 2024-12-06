let addModal;
const modelLists = {
    openai: [
        "gpt-3.5-turbo", "gpt-3.5-turbo-0125", "gpt-3.5-turbo-0301",
        "gpt-3.5-turbo-0613", "gpt-3.5-turbo-1106", "gpt-3.5-turbo-16k",
        "gpt-3.5-turbo-16k-0613", "gpt-3.5-turbo-instruct",
        "gpt-4", "gpt-4-0125-preview", "gpt-4-0314", "gpt-4-0613",
        "gpt-4-1106-preview", "gpt-4-32k", "gpt-4-32k-0314", "gpt-4-32k-0613",
        "gpt-4-all", "gpt-4-gizmo-*", "gpt-4-turbo", "gpt-4-turbo-2024-04-09",
        "gpt-4-turbo-preview", "gpt-4-vision-preview", "gpt-4o", "gpt-4o-2024-05-13",
        "gpt-4o-2024-08-06", "gpt-4o-2024-11-20", "gpt-4o-all", "gpt-4o-audio-preview",
        "gpt-4o-audio-preview-2024-10-01", "gpt-4o-gizmo-*", "gpt-4o-lite", "gpt-4o-mini",
        "gpt-4o-mini-2024-07-18", "gpt-4o-realtime-preview", "gpt-4o-realtime-preview-2024-10-01",
        "chatgpt-4o-latest", "babbage-002", "davinci-002", "code-davinci-edit-001",
        "text-davinci-edit-001", "text-ada-001", "text-babbage-001", "text-curie-001",
        "text-davinci-002", "text-davinci-003", "text-embedding-3-large",
        "text-embedding-3-small", "text-embedding-ada-002", "text-moderation-007",
        "text-moderation-latest", "text-moderation-stable", "dall-e-2", "dall-e-3",
        "tts-1", "tts-1-1106", "tts-1-hd", "tts-1-hd-1106", "whisper-1"
    ],
    anthropic: [
        "claude-2", "claude-2.0", "claude-2.1", "claude-3-5-sonnet-20240620",
        "claude-3-haiku-20240307", "claude-3-opus-20240229", "claude-3-sonnet-20240229",
        "claude-instant-1", "claude-instant-1.2"
    ],
    google: [
        "gemini-1.0-pro", "gemini-1.0-pro-latest", "gemini-1.5-flash",
        "gemini-1.5-flash-002", "gemini-1.5-flash-8b", "gemini-1.5-flash-latest",
        "gemini-1.5-pro", "gemini-1.5-pro-002", "gemini-1.5-pro-latest",
        "gemini-exp-1114", "gemini-exp-1121"
    ],
    other: [
        "grok-beta", "o1-mini", "o1-mini-2024-09-12", "o1-preview",
        "o1-preview-2024-09-12"
    ]
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化模态框
    const modalElement = document.getElementById('addModelModal');
    if (modalElement) {
        addModal = new bootstrap.Modal(modalElement);
    }
    
    // 初始化事件监听器
    const modelProvider = document.getElementById('modelProvider');
    if (modelProvider) {
        modelProvider.addEventListener('change', function(e) {
            const provider = e.target.value;
            const modelSelect = document.getElementById('modelName');
            if (modelSelect) {
                modelSelect.innerHTML = '<option value="">请选择模型...</option>';
                
                if (provider && modelLists[provider]) {
                    modelLists[provider].forEach(model => {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model;
                        modelSelect.appendChild(option);
                    });
                }
            }
        });
    }
    
    // 加载模型列表
    loadModels();
});

// 加载模型列表
function loadModels() {
    // 检查是否在模型管理页面
    const modelList = document.querySelector('.model-list');
    if (!modelList) {
        // 如果不在模型管理页面，直接返回
        console.log('不在模型管理页面，跳过加载模型列表');
        return;
    }

    fetch('/api/models')
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || '加载失败');
            }

            // 清空现有内容
            modelList.innerHTML = '';

            // 显示模型列表
            data.models.forEach(model => {
                const modelElement = document.createElement('div');
                modelElement.className = 'model-item';
                modelElement.innerHTML = `
                    <div class="model-info">
                        <div class="model-name">${model.name}</div>
                    </div>
                    <div class="model-actions">
                        <button class="btn btn-danger btn-sm" onclick="deleteModel('${model.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                modelList.appendChild(modelElement);
            });
        })
        .catch(error => {
            console.error('加载模型列表失败:', error);
            if (document.querySelector('.models-container')) {
                // 只在模型管理页面显示错误提示
                alert('加载模型列表失败，请刷新页面重试');
            }
        });
}

// 删除模型
function deleteModel(id) {
    if (!confirm('确定要删除这个模型吗？')) {
        return;
    }

    fetch(`/api/models?id=${id}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadModels();  // 重新加载模型列表
        } else {
            throw new Error(data.error || '删除失败');
        }
    })
    .catch(error => {
        console.error('删除模型失败:', error);
        alert('删除模型失败，请重试');
    });
}

// 添加新模型
function addModel() {
    const provider = document.getElementById('modelProvider').value;
    const modelName = document.getElementById('modelName').value;

    if (!provider || !modelName) {
        alert('请选择提供商和模型');
        return;
    }

    fetch('/api/models', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            id: modelName,
            name: modelName
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 关闭模态框
            addModal.hide();
            
            // 重置表单
            document.getElementById('modelProvider').value = '';
            document.getElementById('modelName').value = '';
            
            // 重新加载模型列表
            loadModels();
        } else {
            throw new Error(data.error || '添加失败');
        }
    })
    .catch(error => {
        console.error('添加模型失败:', error);
        alert('添加模型失败：' + error.message);
    });
}
