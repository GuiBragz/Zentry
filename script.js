// =======================================
// 1. Variáveis Globais e Configurações Padrão
// =======================================

// Nomes dos cookies para armazenamento
const COOKIE_CONSENT = 'zentry_cookie_accepted';
const CONFIG_COOKIE = 'zentry_pomodoro_config';
const THEME_COOKIE = 'zentry_theme';

// Configurações Padrão do Pomodoro (minutos)
let config = {
    focusTime: 25,
    shortBreak: 5,
    longBreak: 15,
    sessionsBeforeLongBreak: 4,
};

// Estado do Timer
let mode = 'focus'; // 'focus', 'shortBreak', 'longBreak'
let timeLeft = config.focusTime * 60; // Tempo em segundos
let isRunning = false;
let timerInterval;
let currentSession = 1;

// Constantes de Status
const STATUS_OPEN = 'open';
const STATUS_IN_PROGRESS = 'in-progress';
const STATUS_COMPLETED = 'completed';

// Estruturas de Dados (Listas)
let tasks = [];     // Lista que permite subtarefas
let exercises = []; // Lista simples (sem subtarefas)
let activeList = 'tasks'; // Controla qual lista está sendo exibida ('tasks' ou 'exercises')

// --- Elementos do DOM (Interface) ---

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

// Configuração (Modal)
const configButton = document.getElementById('config-button');
const configModalOverlay = document.getElementById('config-modal-overlay');
const focusTimeInput = document.getElementById('focus-time-input');
const shortBreakInput = document.getElementById('short-break-input');
const longBreakInput = document.getElementById('long-break-input');
const saveConfigButton = document.getElementById('save-config-button');
const cancelConfigButton = document.getElementById('cancel-config-button');

// Geral / Outros
const themeSwitch = document.getElementById('nav-theme-switch');
const cookieBanner = document.getElementById('cookie-banner');
const cookieAcceptButton = document.getElementById('cookie-accept-button');
const navButtons = document.querySelectorAll('.nav-button'); // Botões da navegação mobile

// =======================================
// 2. Funções Auxiliares de Cookies
// =======================================

/**
 * Salva um cookie no navegador.
 */
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    // SameSite=Lax é importante para segurança moderna
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax";
}

/**
 * Recupera o valor de um cookie.
 */
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
// 3. Lógica do Pomodoro (Timer)
// =======================================

/**
 * Atualiza o display do timer (MM:SS) e o título da aba.
 */
function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    // Formata com zero à esquerda se necessário (ex: 09:05)
    timerDisplay.textContent = 
        `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    // Atualiza texto e cor do status
    let statusText;
    if (mode === 'focus') {
        statusText = 'Foco';
        timerStatus.className = 'current-mode-focus';
    } else if (mode === 'shortBreak') {
        statusText = 'Pausa Curta';
        timerStatus.className = 'current-mode-break';
    } else {
        statusText = 'Pausa Longa';
        timerStatus.className = 'current-mode-break';
    }
    timerStatus.textContent = statusText;

    // Atualiza título da página
    document.title = `(${timerDisplay.textContent}) Zentry | ${statusText}`;
}

/**
 * Inicia a contagem regressiva.
 */
function startTimer() {
    if (isRunning) return;
    isRunning = true;
    
    // Alterna visibilidade dos botões
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

/**
 * Pausa a contagem regressiva.
 */
function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    
    startButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
}

/**
 * Reseta o timer para o início do ciclo de foco.
 */
function resetTimer() {
    pauseTimer();
    
    // Volta para o padrão
    mode = 'focus';
    currentSession = 1;
    updateTimerMode(); 
    
    startButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
}

/**
 * Lógica executada quando o tempo acaba (Troca de modos).
 */
function handleTimerEnd() {
    // Toca som de notificação (Se desejar, descomente a linha abaixo e adicione o arquivo)
    // new Audio('notification.mp3').play(); 

    if (mode === 'focus') {
        // Se acabou o foco, incrementa sessão e decide qual pausa tirar
        currentSession++; 
        if (currentSession > config.sessionsBeforeLongBreak) {
            mode = 'longBreak';
            currentSession = 1; // Reseta ciclo após pausa longa
        } else {
            mode = 'shortBreak';
        }
    } else {
        // Se acabou a pausa, volta para o foco
        mode = 'focus';
    }

    updateTimerMode();
    startTimer(); // Inicia automaticamente o próximo ciclo
}

/**
 * Recalcula o tempo baseado no modo atual e configuração.
 */
function updateTimerMode() {
    let newTime;
    
    if (mode === 'focus') {
        newTime = config.focusTime;
    } else if (mode === 'shortBreak') {
        newTime = config.shortBreak;
    } else {
        newTime = config.longBreak;
    }

    timeLeft = newTime * 60;
    
    // Atualiza contadores visuais
    currentSessionSpan.textContent = currentSession;
    totalSessionsSpan.textContent = config.sessionsBeforeLongBreak;
    
    updateDisplay();
}

// =======================================
// 4. Lógica da Lista de Tarefas e Exercícios
// =======================================

/**
 * Retorna o array da lista que está ativa no momento.
 */
function getActiveList() {
    if (activeList === 'tasks') {
        return tasks;
    } else {
        return exercises;
    }
}

/**
 * Renderiza a lista completa no HTML.
 */
function renderTasks() {
    taskList.innerHTML = ''; // Limpa a lista atual
    const list = getActiveList();
    
    // Define se a lista atual suporta subtarefas
    const isTaskMode = (activeList === 'tasks'); 
    
    // Atualiza o título do painel
    taskPanelTitle.textContent = isTaskMode ? 'Lista de Tarefas (Z-Cards)' : 'Exercícios';

    list.forEach((masterTask, index) => {
        // Cria o item da lista (Master Task)
        const masterLi = document.createElement('li');
        masterLi.className = `task-item master-task ${masterTask.status}`; 
        
        // --- HEADER DA TAREFA ---
        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-header';

        // 1. Botão Minimizar (Só faz sentido se houver subtarefas, mas mantemos para padrão)
        const minimizeButton = document.createElement('button');
        minimizeButton.className = 'minimize-button';
        minimizeButton.textContent = masterTask.minimized ? '▶' : '▼';
        minimizeButton.onclick = (e) => {
            e.stopPropagation(); 
            toggleMinimize(index);
        };
        
        // 2. Botão Adicionar Subtarefa (Condicional: Só aparece no modo Tarefas)
        const addSubtaskButton = document.createElement('button');
        addSubtaskButton.className = 'add-subtask-button';
        addSubtaskButton.innerHTML = '+'; 
        addSubtaskButton.title = 'Adicionar Subtarefa';
        addSubtaskButton.onclick = (e) => {
            e.stopPropagation(); 
            addSubtaskPrompt(index); // Chama função de prompt
        };
        
        // Se for Exercícios, esconde o botão de adicionar subtarefa
        if (!isTaskMode) {
            addSubtaskButton.style.display = 'none';
            // Opcional: Esconder também o botão de minimizar se não tiver subtarefas
            minimizeButton.style.visibility = 'hidden';
        }
        
        // 3. Texto da Tarefa
        const taskTextSpan = document.createElement('span');
        taskTextSpan.className = 'task-text';
        taskTextSpan.textContent = masterTask.text;

        // 4. Select de Status
        const statusSelect = document.createElement('select');
        statusSelect.className = 'status-select';
        statusSelect.innerHTML = `
            <option value="${STATUS_OPEN}" ${masterTask.status === STATUS_OPEN ? 'selected' : ''}>Aberto</option>
            <option value="${STATUS_IN_PROGRESS}" ${masterTask.status === STATUS_IN_PROGRESS ? 'selected' : ''}>Em Andamento</option>
            <option value="${STATUS_COMPLETED}" ${masterTask.status === STATUS_COMPLETED ? 'selected' : ''}>Concluída</option>
        `;
        statusSelect.onclick = (e) => e.stopPropagation(); // Evita clicks indesejados
        statusSelect.onchange = (e) => {
            updateTaskStatus(index, e.target.value);
        };

        // 5. Botão Deletar
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'x';
        deleteButton.title = 'Remover Item';
        deleteButton.onclick = (e) => {
            e.stopPropagation(); 
            deleteTask(index);
        };
        
        // Monta o Header
        headerDiv.appendChild(minimizeButton);
        if (isTaskMode) headerDiv.appendChild(addSubtaskButton); // Só adiciona se for tarefa
        headerDiv.appendChild(taskTextSpan);
        headerDiv.appendChild(statusSelect);
        headerDiv.appendChild(deleteButton);
        masterLi.appendChild(headerDiv);

        // --- SUBTAREFAS (Renderização) ---
        // Só renderiza se: for modo Tarefas, não estiver minimizado e tiver subtarefas
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
                subDeleteButton.title = 'Remover Subtarefa';
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
    
    // Salva alterações nos cookies sempre que renderizar
    saveTasks(); 
}

/**
 * Adiciona uma nova Master Task (ou Exercício).
 */
function addTask() {
    const text = newTaskText.value.trim();
    if (text === '') return;
    
    // Verificação de consentimento de cookies
    if (getCookie(COOKIE_CONSENT) !== 'true') {
        alert('Por favor, aceite o uso de cookies para salvar suas atividades na próxima visita.');
        return; 
    }

    const list = getActiveList();
    
    // Adiciona o novo item
    list.push({ 
        text: text, 
        status: STATUS_OPEN, 
        minimized: false, 
        subtasks: [] // Array vazio, será preenchido via botão '+' se for Tarefa
    }); 
    
    newTaskText.value = '';
    renderTasks();
}

/**
 * Abre um prompt para adicionar subtarefa a um item específico.
 */
function addSubtaskPrompt(masterIndex) {
    const list = getActiveList();
    const masterTask = list[masterIndex];

    const subtaskText = prompt(`Adicionar Subtarefa para: "${masterTask.text}"`);
    
    if (subtaskText && subtaskText.trim() !== '') {
        masterTask.subtasks.push({
            text: subtaskText.trim(),
            status: STATUS_OPEN
        });
        // Expande automaticamente para mostrar a nova subtarefa
        masterTask.minimized = false; 
        renderTasks();
    }
}

// Funções de Manipulação de Estado (Delete, Status, Minimize)

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

/**
 * Salva as listas nos cookies.
 */
function saveTasks() {
    if (getCookie(COOKIE_CONSENT) !== 'true') return;
    try {
        setCookie('zentry_tasks', JSON.stringify(tasks), 30); 
        setCookie('zentry_exercises', JSON.stringify(exercises), 30);
    } catch (e) {
        console.error('Erro ao salvar listas no cookie:', e);
    }
}

/**
 * Carrega as listas dos cookies.
 */
function loadTasks() {
    if (getCookie(COOKIE_CONSENT) === 'true') {
        const tasksValue = getCookie('zentry_tasks');
        const exercisesValue = getCookie('zentry_exercises');

        try {
            if (tasksValue) tasks = JSON.parse(tasksValue);
            if (exercisesValue) exercises = JSON.parse(exercisesValue);
        } catch (e) {
            console.error('Erro ao carregar listas do cookie:', e);
            tasks = [];
            exercises = [];
        }
    }
    renderTasks();
}

/**
 * Troca entre a lista de Tarefas e Exercícios.
 */
function switchList(type) {
    if (type !== activeList) {
        activeList = type;
        renderTasks();
    }
}

// =======================================
// 5. Configurações e Tema
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
    const newFocus = parseInt(focusTimeInput.value);
    const newShortBreak = parseInt(shortBreakInput.value);
    const newLongBreak = parseInt(longBreakInput.value);

    if (newFocus < 1 || newShortBreak < 1 || newLongBreak < 1 || isNaN(newFocus)) {
        alert('Os tempos de Foco e Pausa devem ser números válidos e maiores que zero.');
        return;
    }

    config = {
        ...config,
        focusTime: newFocus,
        shortBreak: newShortBreak,
        longBreak: newLongBreak,
    };
    
    if (getCookie(COOKIE_CONSENT) === 'true') {
         setCookie(CONFIG_COOKIE, JSON.stringify(config), 365);
    }

    resetTimer(); 
    closeConfigModal();
}

function loadConfig() {
    const savedConfig = getCookie(CONFIG_COOKIE);
    if (savedConfig) {
        try {
            const loaded = JSON.parse(savedConfig);
            config = { ...config, ...loaded }; 
        } catch (e) {
            console.error('Erro ao carregar configuração do Pomodoro:', e);
        }
    }
}

function loadTheme() {
    const savedTheme = getCookie(THEME_COOKIE);
    const isDark = savedTheme === 'dark' || (!savedTheme && document.body.classList.contains('dark'));
    
    document.body.classList.remove('dark', 'light');

    if (isDark) {
        document.body.classList.add('dark');
        themeSwitch.checked = true;
    } else {
        document.body.classList.add('light');
        themeSwitch.checked = false;
    }
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    
    document.body.classList.remove('dark', 'light');

    if (isDark) {
        document.body.classList.add('light');
        if (getCookie(COOKIE_CONSENT) === 'true') setCookie(THEME_COOKIE, 'light', 365);
    } else {
        document.body.classList.add('dark');
        if (getCookie(COOKIE_CONSENT) === 'true') setCookie(THEME_COOKIE, 'dark', 365);
    }
    themeSwitch.checked = !isDark;
}

// =======================================
// 6. Consentimento de Cookies e Navegação Mobile
// =======================================

function handleCookieConsent() {
    if (getCookie(COOKIE_CONSENT) === 'true') {
        cookieBanner.style.display = 'none';
    } else {
        cookieBanner.style.display = 'flex';
    }
}

function acceptCookies() {
    setCookie(COOKIE_CONSENT, 'true', 365);
    cookieBanner.style.display = 'none';
    loadTasks();
    loadConfig();
    // Salva o tema atual
    const isCurrentlyDark = document.body.classList.contains('dark');
    setCookie(THEME_COOKIE, isCurrentlyDark ? 'dark' : 'light', 365);
}

// --- Navegação Mobile ---

function setupMobileNavigation() {
    showPanel('panel-tasks'); // Inicia na aba de tarefas

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetPanel = button.getAttribute('data-panel');
            
            // Atualiza classe active do botão
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            showPanel(targetPanel);
        });
    });
}

function showPanel(targetPanelClass) {
    const panels = document.querySelectorAll('.panel');
    
    // Verifica se é mobile (largura <= 650px conforme CSS)
    const isMobile = window.innerWidth <= 650;
    
    panels.forEach(panel => {
        panel.classList.remove('active-mobile');
        
        if (isMobile) {
            panel.style.display = 'none'; // Esconde todos no mobile
        }
    });

    const activePanel = document.querySelector(`.${targetPanelClass}`);
    if (activePanel) {
        activePanel.classList.add('active-mobile');
        if (isMobile) {
            activePanel.style.display = 'block'; // Mostra apenas o ativo
        }
    }
}

// =======================================
// 7. Inicialização (Event Listeners e Window Load)
// =======================================

// Event Listeners do Timer
startButton.addEventListener('click', startTimer);
pauseButton.addEventListener('click', pauseTimer);
resetButton.addEventListener('click', resetTimer);

// Event Listeners de Configuração
configButton.addEventListener('click', openConfigModal);
saveConfigButton.addEventListener('click', saveConfig);
cancelConfigButton.addEventListener('click', closeConfigModal);
// Fecha modal ao clicar fora
configModalOverlay.addEventListener('click', (e) => {
    if (e.target === configModalOverlay) closeConfigModal();
});

// Event Listeners de Tarefas
newTaskText.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addTask();
    }
});

// Switch de Listas
switchTasks.addEventListener('change', () => switchList('tasks'));
switchExercises.addEventListener('change', () => switchList('exercises'));

// Switch de Tema
themeSwitch.addEventListener('change', toggleTheme);

// Botão de Cookie
cookieAcceptButton.addEventListener('click', acceptCookies);

// Listener de Resize para corrigir navegação se a tela mudar de tamanho
window.addEventListener('resize', () => {
    const currentActive = document.querySelector('.nav-button.active');
    const target = currentActive ? currentActive.getAttribute('data-panel') : 'panel-tasks';
    showPanel(target);
});

// Função Principal de Carga
window.onload = () => {
    handleCookieConsent();
    loadConfig();
    loadTheme();
    loadTasks();
    updateTimerMode(); 
    setupMobileNavigation();
};