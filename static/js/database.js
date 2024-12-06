let currentTable = null;
let currentSchema = null;

// 加载表列表
function loadTables() {
    console.log('开始加载表列表...');
    fetch('/api/database/tables?action=tables')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('获取到表列表:', data);
            const tableList = document.getElementById('tableList');
            tableList.innerHTML = '';
            
            if (!data.tables || !Array.isArray(data.tables)) {
                throw new Error('Invalid data format');
            }
            
            data.tables.forEach(table => {
                const item = document.createElement('a');
                item.className = 'list-group-item list-group-item-action';
                item.textContent = table;
                item.onclick = () => selectTable(table);
                tableList.appendChild(item);
            });
        })
        .catch(error => {
            console.error('加载表列表失败:', error);
            alert('加载表列表失败: ' + error.message);
        });
}

// 选择表
function selectTable(table) {
    console.log('选择表:', table);
    currentTable = table;
    document.getElementById('currentTable').textContent = table;
    
    // 更新选中状态
    document.querySelectorAll('#tableList .list-group-item').forEach(item => {
        item.classList.remove('active');
        if (item.textContent === table) {
            item.classList.add('active');
        }
    });
    
    // 加载表结构和数据
    loadTableSchema(table);
    loadTableData(table);
}

// 加载表结构
function loadTableSchema(table) {
    console.log('加载表结构:', table);
    fetch(`/api/database/schema?action=schema&table=${encodeURIComponent(table)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('获取到表结构:', data);
            if (!data.columns || !Array.isArray(data.columns)) {
                throw new Error('Invalid schema format');
            }
            currentSchema = data.columns;
            renderTableHeader(data.columns);
        })
        .catch(error => {
            console.error('加载表结构失败:', error);
            alert('加载表结构失败: ' + error.message);
        });
}

// 加载表数据
function loadTableData(table) {
    console.log('加载表数据:', table);
    fetch(`/api/database/data?action=data&table=${encodeURIComponent(table)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('获取到表数据:', data);
            if (!data.data || !Array.isArray(data.data)) {
                throw new Error('Invalid data format');
            }
            renderTableData(data.data);
        })
        .catch(error => {
            console.error('加载表数据失败:', error);
            alert('加载表数据失败: ' + error.message);
        });
}

// 渲染表头
function renderTableHeader(columns) {
    const thead = document.querySelector('#dataTable thead');
    thead.innerHTML = '';
    
    const tr = document.createElement('tr');
    columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = `${column.name} (${column.type})`;
        if (column.pk) th.classList.add('table-primary');
        tr.appendChild(th);
    });
    
    // 添加操作列
    const actionTh = document.createElement('th');
    actionTh.textContent = '操作';
    actionTh.style.width = '100px';
    tr.appendChild(actionTh);
    
    thead.appendChild(tr);
}

// 渲染表数据
function renderTableData(data) {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        // 数据列
        Object.values(row).forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            td.classList.add('editable');
            tr.appendChild(td);
        });
        
        // 操作列
        const actionTd = document.createElement('td');
        actionTd.className = 'action-buttons';
        actionTd.innerHTML = `
            <div class="btn-group btn-group-sm">
                <button class="btn btn-primary" onclick="showEditRowModal(this.closest('tr'))">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteRow(this.closest('tr'))">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        tr.appendChild(actionTd);
        
        tbody.appendChild(tr);
    });
}

// 显示添加行模态框
function showAddRowModal() {
    if (!currentTable || !currentSchema) {
        alert('请先选择一个表');
        return;
    }
    
    const form = document.getElementById('addRowForm');
    form.innerHTML = '';
    
    currentSchema.forEach(column => {
        if (column.pk) return; // 跳过主键
        
        const div = document.createElement('div');
        div.className = 'mb-3';
        div.innerHTML = `
            <label class="form-label">${column.name} (${column.type})</label>
            <input type="text" class="form-control" name="${column.name}" 
                   ${column.notnull ? 'required' : ''}>
        `;
        form.appendChild(div);
    });
    
    const modal = new bootstrap.Modal(document.getElementById('addRowModal'));
    modal.show();
}

// 添加行
function addRow() {
    const form = document.getElementById('addRowForm');
    const formData = new FormData(form);
    const data = {
        table: currentTable,
        columns: [],
        values: []
    };
    
    formData.forEach((value, key) => {
        if (value.trim()) {
            data.columns.push(key);
            data.values.push(value.trim());
        }
    });
    
    fetch('/api/database/insert', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // 关闭模态框并刷新数据
        bootstrap.Modal.getInstance(document.getElementById('addRowModal')).hide();
        loadTableData(currentTable);
    })
    .catch(error => {
        console.error('添加数据失败:', error);
        alert('添加数据失败: ' + error.message);
    });
}

// 显示编辑行模态框
function showEditRowModal(tr) {
    const form = document.getElementById('editRowForm');
    form.innerHTML = '';
    
    const cells = tr.cells;
    currentSchema.forEach((column, index) => {
        if (column.pk) return; // 跳过主键
        
        const div = document.createElement('div');
        div.className = 'mb-3';
        div.innerHTML = `
            <label class="form-label">${column.name} (${column.type})</label>
            <input type="text" class="form-control" name="${column.name}" 
                   value="${cells[index].textContent}"
                   ${column.notnull ? 'required' : ''}>
        `;
        form.appendChild(div);
    });
    
    // 存储行ID
    form.dataset.rowId = cells[0].textContent;
    
    const modal = new bootstrap.Modal(document.getElementById('editRowModal'));
    modal.show();
}

// 更新行
function updateRow() {
    const form = document.getElementById('editRowForm');
    const formData = new FormData(form);
    const updates = {};
    
    formData.forEach((value, key) => {
        if (value.trim()) {
            updates[key] = value.trim();
        }
    });
    
    fetch('/api/database/update', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            table: currentTable,
            id: form.dataset.rowId,
            updates: updates
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // 关闭模态框并刷新数据
        bootstrap.Modal.getInstance(document.getElementById('editRowModal')).hide();
        loadTableData(currentTable);
    })
    .catch(error => {
        console.error('更新数据失败:', error);
        alert('更新数据失败: ' + error.message);
    });
}

// 删除行
function deleteRow(tr) {
    if (!confirm('确定要删除这行数据吗？')) return;
    
    const rowId = tr.cells[0].textContent;
    
    fetch(`/api/database/row?table=${currentTable}&id=${rowId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        loadTableData(currentTable);
    })
    .catch(error => {
        console.error('删除数据失败:', error);
        alert('删除数据失败: ' + error.message);
    });
}

// 清空表
function truncateTable() {
    if (!currentTable) {
        alert('请先选择一个表');
        return;
    }
    
    if (!confirm(`确定要清空 ${currentTable} 表吗？此操作不可恢复！`)) return;
    
    fetch(`/api/database/truncate?action=truncate&table=${currentTable}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        loadTableData(currentTable);
    })
    .catch(error => {
        console.error('清空表失败:', error);
        alert('清空表失败: ' + error.message);
    });
}

// 刷新表数据
function refreshTable() {
    if (currentTable) {
        loadTableData(currentTable);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载表列表
    const databaseTab = document.getElementById('database-tab');
    if (databaseTab) {
        // 当数据库标签被激活时加载数据
        databaseTab.addEventListener('shown.bs.tab', function() {
            loadTables();
        });
        
        // 如果当前就在数据库标签，立即加载
        if (databaseTab.classList.contains('active')) {
            loadTables();
        }
    } else {
        console.error('数据库管理标签不存在');
    }

    // 绑定按钮事件
    document.getElementById('refreshTableButton').addEventListener('click', refreshTable);
    document.getElementById('addRowButton').addEventListener('click', showAddRowModal);
    document.getElementById('truncateTableButton').addEventListener('click', truncateTable);
    document.getElementById('addRowSubmitButton').addEventListener('click', addRow);
    document.getElementById('editRowSubmitButton').addEventListener('click', updateRow);
}); 