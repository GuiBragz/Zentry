// =======================================
// 1. Variáveis Globais e Configurações
// =======================================

// Chaves para Cookies
const COOKIE_CONSENT = 'zentry_cookie_accepted';
const CONFIG_COOKIE = 'zentry_pomodoro_config';
const THEME_COOKIE = 'zentry_theme';

// Configurações Padrão do Pomodoro (Minutos)
let config = {
    focusTime: 25,
    shortBreak: 5,
    longBreak: 15,
    sessionsBeforeLongBreak: 4,
};

// Estado do Sistema
let mode = 'focus'; // 'focus', 'shortBreak', 'longBreak'
let timeLeft = config.focusTime * 60; 
let isRunning = false;
let timerInterval;
let currentSession = 1;

// Som do Alarme (Link direto para um beep simples)
const alarmSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

// Status das Tarefas
const STATUS_OPEN = 'open';
const STATUS_IN_PROGRESS = 'in-progress';
const STATUS_COMPLETED = 'completed';

// Dados (Listas)
let tasks = [];
let exercises = [];
let activeList = 'tasks'; // Controla a aba ativa

// --- Seleção de Elementos do DOM ---

// Timer
const timerDisplay = document.getElementById('timer-display');
const timerStatus = document.getElementById('timer-status');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const resetButton = document.getElementById('reset-button');
const currentSessionSpan = document.getElementById('current-session');
const totalSessionsSpan = document.getElementById('total-sessions');

// Tarefas
const taskList = document.getElementById('task-list');
const newTaskText = document.getElementById('new-task-text');
const taskPanelTitle = document.getElementById('task-panel-title');
const switchTasks = document.getElementById('switch-tasks');
const switchExercises = document.getElementById('switch-exercises');

// Configuração e Modais
const configButton = document.getElementById('config-button');
const configModalOverlay = document.getElementById('config-modal-overlay');
const focusTimeInput = document.getElementById('focus-time-input');
const shortBreakInput = document.getElementById('short-break-input');
const longBreakInput = document.getElementById('long-break-input');
const saveConfigButton = document.getElementById('save-config-button');
const cancelConfigButton = document.getElementById('cancel-config-button');

// Geral / Navegação
const themeSwitch = document.getElementById('nav-theme-switch');
const cookieBanner = document.getElementById('cookie-banner');
const cookieAcceptButton = document.getElementById('cookie-accept-button');
const navButtons = document.querySelectorAll('.nav-button');
const projectIntro = document.querySelector('.project-intro'); // Referência à descrição

// =======================================
// 2. Funções de Cookies (Persistência)
// =======================================

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// =======================================
// 3. Lógica do Pomodoro e Alarme
// =======================================

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    // Formata MM:SS
    timerDisplay.textContent = 
        `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    // Atualiza texto e estilo do status
    let statusText;
    if (mode === 'focus') {
        statusText = 'FOCO';
        timerStatus.className = 'timer-mode';
    } else {
        statusText = (mode === 'shortBreak') ? 'PAUSA CURTA' : 'PAUSA LONGA';
        timerStatus.className = 'timer-mode break-mode';
    }
    timerStatus.textContent = statusText;
    document.title = `(${timerDisplay.textContent}) Zentry`;
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    
    // Remove classe de alarme se o usuário iniciar o timer
    timerDisplay.classList.remove('timer-alarm');
    
    startButton.style.display = 'none';
    pauseButton.style.display = 'inline-block';
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft < 0) {
            clearInterval(timerInterval);
            handleTimerEnd();
        }
    }, 1000);
}

function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    
    startButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
}

function resetTimer() {
    pauseTimer();
    mode = 'focus';
    currentSession = 1;
    timerDisplay.classList.remove('timer-alarm'); // Limpa alarme visual
    updateTimerMode(); 
    
    startButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
}

function handleTimerEnd() {
    // 1. Tocar Alarme Sonoro
    alarmSound.play().catch(error => console.log("Interação necessária para tocar áudio"));
    
    // 2. Ativar Alarme Visual (Piscar Vermelho definido no CSS)
    timerDisplay.classList.add('timer-alarm');

    // 3. Alternar Modos
    if (mode === 'focus') {
        currentSession++; 
        if (currentSession > config.sessionsBeforeLongBreak) {
            mode = 'longBreak';
            currentSession = 1; 
        } else {
            mode = 'shortBreak';
        }
    } else {
        mode = 'focus';
    }

    updateTimerMode();
    
    // Para o timer para o usuário ouvir o alarme. O usuário deve clicar em "Iniciar" para continuar.
    isRunning = false;
    startButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
}

function updateTimerMode() {
    let newTime;
    if (mode === 'focus') newTime = config.focusTime;
    else if (mode === 'shortBreak') newTime = config.shortBreak;
    else newTime = config.longBreak;

    timeLeft = newTime * 60;
    
    currentSessionSpan.textContent = currentSession;
    totalSessionsSpan.textContent = config.sessionsBeforeLongBreak;
    updateDisplay();
}

// =======================================
// 4. Lógica de Tarefas (Z-Cards)
// =======================================

function getActiveList() {
    return activeList === 'tasks' ? tasks : exercises;
}

function renderTasks() {
    taskList.innerHTML = '';
    const list = getActiveList();
    
    // Verifica se estamos no modo "Tarefas" (que permite subtarefas)
    const isTaskMode = (activeList === 'tasks');
    
    taskPanelTitle.textContent = isTaskMode ? 'Lista de Tarefas (Z-Cards)' : 'Exercícios';

    list.forEach((masterTask, index) => {
        const masterLi = document.createElement('li');
        masterLi.className = `task-item master-task ${masterTask.status}`; 
        
        // --- Header da Tarefa ---
        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-header';

        // Botão Minimizar
        const minimizeButton = document.createElement('button');
        minimizeButton.className = 'minimize-button';
        minimizeButton.textContent = masterTask.minimized ? '▶' : '▼';
        minimizeButton.onclick = (e) => {
            e.stopPropagation(); 
            toggleMinimize(index);
        };
        
        // Botão Adicionar Subtarefa (Só aparece se for "Tarefas")
        const addSubtaskButton = document.createElement('button');
        addSubtaskButton.className = 'add-subtask-button';
        addSubtaskButton.innerHTML = '+'; 
        addSubtaskButton.title = 'Adicionar Subtarefa';
        addSubtaskButton.onclick = (e) => {
            e.stopPropagation(); 
            addSubtaskPrompt(index); 
        };
        
        if (!isTaskMode) {
            addSubtaskButton.style.display = 'none';
            minimizeButton.style.visibility = 'hidden'; // Sem subtarefas, não precisa minimizar
        }
        
        const taskTextSpan = document.createElement('span');
        taskTextSpan.className = 'task-text';
        taskTextSpan.textContent = masterTask.text;

        // Select de Status
        const statusSelect = document.createElement('select');
        statusSelect.className = 'status-select';
        statusSelect.innerHTML = `
            <option value="${STATUS_OPEN}" ${masterTask.status === STATUS_OPEN ? 'selected' : ''}>Aberto</option>
            <option value="${STATUS_IN_PROGRESS}" ${masterTask.status === STATUS_IN_PROGRESS ? 'selected' : ''}>Andamento</option>
            <option value="${STATUS_COMPLETED}" ${masterTask.status === STATUS_COMPLETED ? 'selected' : ''}>Concluída</option>
        `;
        statusSelect.onclick = (e) => e.stopPropagation(); 
        statusSelect.onchange = (e) => {
            updateTaskStatus(index, e.target.value);
        };

        // Botão Excluir
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'x';
        deleteButton.title = 'Remover Tarefa Principal';
        deleteButton.className = 'delete-btn';
        deleteButton.onclick = (e) => {
            e.stopPropagation(); 
            deleteTask(index);
        };
        
        // Montagem
        headerDiv.appendChild(minimizeButton);
        if (isTaskMode) headerDiv.appendChild(addSubtaskButton);
        headerDiv.appendChild(taskTextSpan);
        headerDiv.appendChild(statusSelect);
        headerDiv.appendChild(deleteButton);
        masterLi.appendChild(headerDiv);

        // --- Renderização de Subtarefas (Se existirem e não estiver minimizado) ---
        if (isTaskMode && !masterTask.minimized && masterTask.subtasks && masterTask.subtasks.length > 0) {
            const subtaskList = document.createElement('ul');
            subtaskList.className = 'subtask-list';

            masterTask.subtasks.forEach((subtask, subIndex) => {
                const subLi = document.createElement('li');
                subLi.className = `subtask-item ${subtask.status}`;

                const subTaskTextSpan = document.createElement('span');
                subTaskTextSpan.className = 'subtask-text';
                subTaskTextSpan.textContent = subtask.text;

                const subStatusSelect = document.createElement('select');
                subStatusSelect.className = 'status-select sub-status';
                subStatusSelect.innerHTML = `
                    <option value="${STATUS_OPEN}" ${subtask.status === STATUS_OPEN ? 'selected' : ''}>Aberto</option>
                    <option value="${STATUS_IN_PROGRESS}" ${subtask.status === STATUS_IN_PROGRESS ? 'selected' : ''}>Andamento</option>
                    <option value="${STATUS_COMPLETED}" ${subtask.status === STATUS_COMPLETED ? 'selected' : ''}>Concluída</option>
                `;
                subStatusSelect.onclick = (e) => e.stopPropagation(); 
                subStatusSelect.onchange = (e) => {
                    updateSubTaskStatus(index, subIndex, e.target.value);
                };
                
                const subDeleteButton = document.createElement('button');
                subDeleteButton.textContent = 'x';
                subDeleteButton.className = 'delete-btn';
                subDeleteButton.onclick = (e) => {
                    e.stopPropagation(); 
                    deleteSubTask(index, subIndex);
                };

                subLi.appendChild(subTaskTextSpan);
                subLi.appendChild(subStatusSelect);
                subLi.appendChild(subDeleteButton);
                subtaskList.appendChild(subLi);
            });

            masterLi.appendChild(subtaskList);
        }
        
        taskList.appendChild(masterLi);
    });
    
    saveTasks(); 
}

function addTask() {
    const text = newTaskText.value.trim();
    if (text === '') return;
    
    if (getCookie(COOKIE_CONSENT) !== 'true') {
        alert('Por favor, aceite o uso de cookies para salvar suas atividades.');
        return; 
    }

    const list = getActiveList();
    list.push({ 
        text: text, 
        status: STATUS_OPEN, 
        minimized: false, 
        subtasks: [] 
    }); 
    
    newTaskText.value = '';
    renderTasks();
}

function addSubtaskPrompt(masterIndex) {
    const list = getActiveList();
    const masterTask = list[masterIndex];

    const subtaskText = prompt(`Adicionar Subtarefa para: "${masterTask.text}"`);
    
    if (subtaskText && subtaskText.trim() !== '') {
        masterTask.subtasks.push({
            text: subtaskText.trim(),
            status: STATUS_OPEN
        });
        masterTask.minimized = false; 
        renderTasks();
    }
}

// Funções de Manipulação de Array
function deleteTask(index) {
    const list = getActiveList();
    list.splice(index, 1);
    renderTasks();
}

function updateTaskStatus(index, newStatus) {
    const list = getActiveList();
    if (list[index]) {
        list[index].status = newStatus;
        renderTasks(); 
    }
}

function toggleMinimize(index) {
    const list = getActiveList();
    if (list[index]) {
        list[index].minimized = !list[index].minimized;
        renderTasks();
    }
}

function updateSubTaskStatus(masterIndex, subIndex, newStatus) {
    const list = getActiveList();
    if (list[masterIndex] && list[masterIndex].subtasks[subIndex]) {
        list[masterIndex].subtasks[subIndex].status = newStatus;
        renderTasks();
    }
}

function deleteSubTask(masterIndex, subIndex) {
    const list = getActiveList();
    if (list[masterIndex] && list[masterIndex].subtasks[subIndex]) {
        list[masterIndex].subtasks.splice(subIndex, 1);
        renderTasks();
    }
}

function saveTasks() {
    if (getCookie(COOKIE_CONSENT) !== 'true') return;
    setCookie('zentry_tasks', JSON.stringify(tasks), 30); 
    setCookie('zentry_exercises', JSON.stringify(exercises), 30);
}

function loadTasks() {
    if (getCookie(COOKIE_CONSENT) === 'true') {
        const t = getCookie('zentry_tasks');
        const e = getCookie('zentry_exercises');
        try {
            if (t) tasks = JSON.parse(t);
            if (e) exercises = JSON.parse(e);
        } catch (err) {
            console.error('Erro ao carregar cookies', err);
        }
    }
    renderTasks();
}

function switchList(type) {
    activeList = type;
    renderTasks();
}

// =======================================
// 5. Configurações e Temas
// =======================================

function openConfigModal() {
    focusTimeInput.value = config.focusTime;
    shortBreakInput.value = config.shortBreak;
    longBreakInput.value = config.longBreak;
    configModalOverlay.style.display = 'flex';
}

function closeConfigModal() {
    configModalOverlay.style.display = 'none';
}

function saveConfig() {
    const f = parseInt(focusTimeInput.value);
    const s = parseInt(shortBreakInput.value);
    const l = parseInt(longBreakInput.value);

    if (f > 0 && s > 0 && l > 0) {
        config = { ...config, focusTime: f, shortBreak: s, longBreak: l };
        if (getCookie(COOKIE_CONSENT) === 'true') {
             setCookie(CONFIG_COOKIE, JSON.stringify(config), 365);
        }
        resetTimer(); 
        closeConfigModal();
    } else {
        alert('Valores inválidos');
    }
}

function loadConfig() {
    const saved = getCookie(CONFIG_COOKIE);
    if (saved) {
        try { config = { ...config, ...JSON.parse(saved) }; } catch (e) {}
    }
}

function loadTheme() {
    const savedTheme = getCookie(THEME_COOKIE);
    const isDark = savedTheme === 'dark' || (!savedTheme && document.body.classList.contains('dark'));
    document.body.className = isDark ? 'dark' : 'light';
    themeSwitch.checked = isDark;
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    document.body.className = isDark ? 'light' : 'dark';
    if (getCookie(COOKIE_CONSENT) === 'true') setCookie(THEME_COOKIE, isDark ? 'light' : 'dark', 365);
    themeSwitch.checked = !isDark;
}

// =======================================
// 6. Navegação Mobile & Responsividade
// =======================================

function setupMobileNavigation() {
    // Inicia mostrando tarefas
    showPanel('panel-tasks');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetPanel = button.getAttribute('data-panel');
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            showPanel(targetPanel);
        });
    });
}

/**
 * Controla qual painel é exibido e a visibilidade da Descrição
 */
function showPanel(targetClass) {
    const isMobile = window.innerWidth <= 768;
    const panels = document.querySelectorAll('.panel');
    
    panels.forEach(p => {
        p.classList.remove('active-mobile');
        if (isMobile) p.style.display = 'none';
    });

    const active = document.querySelector(`.${targetClass}`);
    if (active) {
        active.classList.add('active-mobile');
        if (isMobile) active.style.display = 'flex';
    }

    // Lógica da Descrição (.project-intro) no Mobile
    // Solicitação: "Mobile bota a descrição menor e apenas na tela de tarefas"
    if (isMobile) {
        if (targetClass === 'panel-tasks') {
            projectIntro.style.display = 'block';
        } else {
            projectIntro.style.display = 'none';
        }
    } else {
        // No Desktop sempre mostra
        projectIntro.style.display = 'block';
    }
}

function handleCookieConsent() {
    if (getCookie(COOKIE_CONSENT) === 'true') {
        cookieBanner.style.display = 'none';
    } else {
        cookieBanner.style.display = 'flex';
    }
}

// =======================================
// 7. Inicialização
// =======================================

startButton.addEventListener('click', startTimer);
pauseButton.addEventListener('click', pauseTimer);
resetButton.addEventListener('click', resetTimer);

configButton.addEventListener('click', openConfigModal);
saveConfigButton.addEventListener('click', saveConfig);
cancelConfigButton.addEventListener('click', closeConfigModal);
configModalOverlay.addEventListener('click', (e) => { if (e.target === configModalOverlay) closeConfigModal(); });

newTaskText.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });
switchTasks.addEventListener('change', () => switchList('tasks'));
switchExercises.addEventListener('change', () => switchList('exercises'));

themeSwitch.addEventListener('change', toggleTheme);

cookieAcceptButton.addEventListener('click', () => {
    setCookie(COOKIE_CONSENT, 'true', 365);
    cookieBanner.style.display = 'none';
    loadTasks();
    loadConfig();
    setCookie(THEME_COOKIE, document.body.className, 365);
});

window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.nav-button.active');
    const target = activeBtn ? activeBtn.getAttribute('data-panel') : 'panel-tasks';
    showPanel(target);
});

window.onload = () => {
    handleCookieConsent();
    loadConfig();
    loadTheme();
    loadTasks();
    updateTimerMode(); 
    setupMobileNavigation();
};