// =======================================
// 1. Variáveis Globais e Configurações
// =======================================

const COOKIE_CONSENT = 'zentry_cookie_accepted';
const CONFIG_COOKIE = 'zentry_pomodoro_config';
const THEME_COOKIE = 'zentry_theme';

// Configurações Padrão
let config = { focusTime: 25, shortBreak: 5, longBreak: 15, sessionsBeforeLongBreak: 4 };
let mode = 'focus'; 
let timeLeft = config.focusTime * 60; 
let isRunning = false;
let timerInterval;
let currentSession = 1;

const alarmSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_long.ogg');

let tasks = [];
let exercises = [];
let activeList = 'tasks'; 

// =======================================
// 2. Seleção de Elementos (GLOBAIS)
// =======================================
// Selecionamos fora para garantir que todas as funções enxerguem

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

// Modais - Configuração
const configButton = document.getElementById('config-button');
const configModalOverlay = document.getElementById('config-modal-overlay');
const focusTimeInput = document.getElementById('focus-time-input');
const shortBreakInput = document.getElementById('short-break-input');
const longBreakInput = document.getElementById('long-break-input');
const saveConfigButton = document.getElementById('save-config-button');
const cancelConfigButton = document.getElementById('cancel-config-button');

// Modais - Feedback
const feedbackTrigger = document.getElementById('feedback-trigger');
const feedbackModal = document.getElementById('feedback-modal-overlay');
const cancelFeedbackBtn = document.getElementById('cancel-feedback-button');
const feedbackText = document.getElementById('feedback-text');

// Outros
const themeSwitch = document.getElementById('nav-theme-switch');
const cookieBanner = document.getElementById('cookie-banner');
const cookieAcceptButton = document.getElementById('cookie-accept-button');
const navButtons = document.querySelectorAll('.nav-button');
const projectIntro = document.querySelector('.project-intro');

// =======================================
// 3. Funções do Pomodoro
// =======================================

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    let statusText = (mode === 'focus') ? 'FOCO' : (mode === 'shortBreak' ? 'PAUSA CURTA' : 'PAUSA LONGA');
    timerStatus.textContent = statusText;
    timerStatus.className = (mode === 'focus') ? 'timer-mode' : 'timer-mode break-mode';
    document.title = `(${timerDisplay.textContent}) Zentry`;
}

function startTimer() {
    if (isRunning) return; 
    isRunning = true;
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
    timerDisplay.classList.remove('timer-alarm');
    updateTimerMode(); 
    startButton.style.display = 'inline-block'; 
    pauseButton.style.display = 'none';
}

function handleTimerEnd() {
    alarmSound.play().catch(e => console.log("Audio bloqueado"));
    timerDisplay.classList.add('timer-alarm');

    if (mode === 'focus') {
        currentSession++; 
        mode = (currentSession > config.sessionsBeforeLongBreak) ? 'longBreak' : 'shortBreak';
        if (mode === 'longBreak') currentSession = 1;
    } else {
        mode = 'focus';
    }
    updateTimerMode();
    isRunning = false; 
    startButton.style.display = 'inline-block'; 
    pauseButton.style.display = 'none';
}

function updateTimerMode() {
    let newTime = (mode === 'focus') ? config.focusTime : (mode === 'shortBreak' ? config.shortBreak : config.longBreak);
    timeLeft = newTime * 60;
    if(currentSessionSpan) currentSessionSpan.textContent = currentSession;
    if(totalSessionsSpan) totalSessionsSpan.textContent = config.sessionsBeforeLongBreak;
    updateDisplay();
}

// =======================================
// 4. Configuração (A Correção Está Aqui)
// =======================================

function openConfigModal() {
    if(focusTimeInput) focusTimeInput.value = config.focusTime;
    if(shortBreakInput) shortBreakInput.value = config.shortBreak;
    if(longBreakInput) longBreakInput.value = config.longBreak;
    configModalOverlay.style.display = 'flex';
}

function saveConfig() {
    const f = parseInt(focusTimeInput.value);
    const s = parseInt(shortBreakInput.value);
    const l = parseInt(longBreakInput.value);

    if (f > 0 && s > 0 && l > 0) {
        config.focusTime = f; 
        config.shortBreak = s; 
        config.longBreak = l;
        
        if (getCookie(COOKIE_CONSENT) === 'true') {
             setCookie(CONFIG_COOKIE, JSON.stringify(config), 365);
        }
        
        resetTimer(); 
        configModalOverlay.style.display = 'none';
    } else {
        alert('Por favor, insira valores válidos (maiores que 0).');
    }
}

// =======================================
// 5. Tarefas (Funções Globais para o HTML)
// =======================================

// Torna as funções acessíveis ao HTML (onclick)
window.addTask = function() {
    const text = newTaskText.value.trim();
    if (text === '') return;
    if (getCookie(COOKIE_CONSENT) !== 'true') { alert('Aceite os cookies para salvar.'); return; }
    
    const list = (activeList === 'tasks') ? tasks : exercises;
    list.push({ text: text, status: 'open', minimized: false, subtasks: [] }); 
    newTaskText.value = '';
    renderTasks();
};

window.deleteTask = function(index) {
    const list = (activeList === 'tasks') ? tasks : exercises;
    list.splice(index, 1); 
    renderTasks();
};

window.toggleMinimize = function(index) {
    const list = (activeList === 'tasks') ? tasks : exercises;
    if(list[index]) list[index].minimized = !list[index].minimized; 
    renderTasks();
};

window.updateTaskStatus = function(index, newStatus) {
    const list = (activeList === 'tasks') ? tasks : exercises;
    if(list[index]) list[index].status = newStatus; 
    renderTasks();
};

window.addSubtaskPrompt = function(index) {
    const list = (activeList === 'tasks') ? tasks : exercises;
    const subtext = prompt("Nova subtarefa:");
    if (subtext) {
        list[index].subtasks.push({ text: subtext, status: 'open' });
        list[index].minimized = false;
        renderTasks();
    }
};

window.updateSubTaskStatus = function(masterIndex, subIndex, newStatus) {
    const list = (activeList === 'tasks') ? tasks : exercises;
    if(list[masterIndex]) list[masterIndex].subtasks[subIndex].status = newStatus;
    renderTasks();
};

window.deleteSubTask = function(masterIndex, subIndex) {
    const list = (activeList === 'tasks') ? tasks : exercises;
    if(list[masterIndex]) list[masterIndex].subtasks.splice(subIndex, 1);
    renderTasks();
};

function renderTasks() {
    taskList.innerHTML = '';
    const list = (activeList === 'tasks') ? tasks : exercises;
    const canHaveSubtasks = (activeList === 'tasks');
    
    taskPanelTitle.textContent = canHaveSubtasks ? 'Lista de Tarefas' : 'Tarefas Unicas';

    list.forEach((masterTask, index) => {
        const masterLi = document.createElement('li');
        masterLi.className = `task-item master-task ${masterTask.status}`; 
        
        // Botões e Lógica de Exibição
        const displaySubBtn = canHaveSubtasks ? 'inline-block' : 'none';
        const displayMinBtn = canHaveSubtasks ? 'inline-block' : 'hidden'; // Oculta mas ocupa espaço ou none? Vamos usar visibility se quiser alinhar

        // HTML Interno do Card
        masterLi.innerHTML = `
            <div class="task-header">
                <button class="minimize-button" style="visibility: ${masterTask.subtasks.length > 0 ? 'visible' : 'hidden'}; display: ${canHaveSubtasks ? 'inline-block' : 'none'}" onclick="toggleMinimize(${index})">
                    ${masterTask.minimized ? '▶' : '▼'}
                </button>
                <button class="add-subtask-button" style="display: ${displaySubBtn}" onclick="addSubtaskPrompt(${index})" title="Adicionar Subtarefa">+</button>
                
                <span class="task-text">${masterTask.text}</span>
                
                <select class="status-select" onchange="updateTaskStatus(${index}, this.value)" onclick="event.stopPropagation()">
                    <option value="open" ${masterTask.status === 'open' ? 'selected' : ''}>Aberto</option>
                    <option value="in-progress" ${masterTask.status === 'in-progress' ? 'selected' : ''}>Andamento</option>
                    <option value="completed" ${masterTask.status === 'completed' ? 'selected' : ''}>Concluída</option>
                </select>
                
                <button class="delete-btn" onclick="deleteTask(${index})" title="Remover">x</button>
            </div>
        `;

        // Renderiza Subtarefas
        if (canHaveSubtasks && !masterTask.minimized && masterTask.subtasks.length > 0) {
            const subUl = document.createElement('ul');
            subUl.className = 'subtask-list';
            
            masterTask.subtasks.forEach((sub, subIndex) => {
                const subLi = document.createElement('li');
                subLi.className = `subtask-item ${sub.status}`;
                subLi.innerHTML = `
                    <span class="subtask-text">${sub.text}</span>
                    <select class="status-select" style="font-size: 0.75em" onchange="updateSubTaskStatus(${index}, ${subIndex}, this.value)">
                        <option value="open" ${sub.status === 'open' ? 'selected' : ''}>Aberto</option>
                        <option value="in-progress" ${sub.status === 'in-progress' ? 'selected' : ''}>Andamento</option>
                        <option value="completed" ${sub.status === 'completed' ? 'selected' : ''}>Concluída</option>
                    </select>
                    <button class="delete-btn" style="font-size: 0.9em" onclick="deleteSubTask(${index}, ${subIndex})">x</button>
                `;
                subUl.appendChild(subLi);
            });
            masterLi.appendChild(subUl);
        }
        
        taskList.appendChild(masterLi);
    });
    saveTasks();
}

function saveTasks() {
    if (getCookie(COOKIE_CONSENT) !== 'true') return;
    setCookie('zentry_tasks', JSON.stringify(tasks), 30); 
    setCookie('zentry_exercises', JSON.stringify(exercises), 30);
}

function loadTasks() {
    if (getCookie(COOKIE_CONSENT) === 'true') {
        try {
            const t = getCookie('zentry_tasks'); if(t) tasks = JSON.parse(t);
            const e = getCookie('zentry_exercises'); if(e) exercises = JSON.parse(e);
        } catch (e) {}
    }
    renderTasks();
}

// =======================================
// 6. Cookies e Tema
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

function loadTheme() {
    const savedTheme = getCookie(THEME_COOKIE);
    // Padrão dark se não tiver cookie
    const isDark = savedTheme === 'dark' || !savedTheme;
    
    if (isDark) {
        document.body.classList.remove('light');
        document.body.classList.add('dark');
        if(themeSwitch) themeSwitch.checked = true;
    } else {
        document.body.classList.remove('dark');
        document.body.classList.add('light');
        if(themeSwitch) themeSwitch.checked = false;
    }
}

function toggleTheme() {
    const isCurrentlyDark = document.body.classList.contains('dark');
    
    if (isCurrentlyDark) {
        document.body.classList.replace('dark', 'light');
        if (getCookie(COOKIE_CONSENT) === 'true') setCookie(THEME_COOKIE, 'light', 365);
    } else {
        document.body.classList.replace('light', 'dark');
        if (getCookie(COOKIE_CONSENT) === 'true') setCookie(THEME_COOKIE, 'dark', 365);
    }
}

// =======================================
// 7. Mobile Nav & Init
// =======================================

function setupMobileNavigation() {
    showPanel('panel-tasks');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showPanel(btn.getAttribute('data-panel'));
        });
    });
}

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

    if (isMobile) {
        if(projectIntro) projectIntro.style.display = (targetClass === 'panel-tasks') ? 'block' : 'none';
    } else {
        if(projectIntro) projectIntro.style.display = 'block';
    }
}

function loadConfig() {
    const saved = getCookie(CONFIG_COOKIE);
    if (saved) { try { config = { ...config, ...JSON.parse(saved) }; } catch (e) {} }
}

function handleCookieConsent() {
    if (getCookie(COOKIE_CONSENT) === 'true') cookieBanner.style.display = 'none';
    else cookieBanner.style.display = 'flex';
}

// --- EVENT LISTENERS DE INICIALIZAÇÃO ---
window.onload = () => {
    // Carrega dados
    handleCookieConsent();
    loadConfig();
    loadTheme();
    loadTasks();
    updateTimerMode(); 
    setupMobileNavigation();

    // Timer Events
    startButton.addEventListener('click', startTimer);
    pauseButton.addEventListener('click', pauseTimer);
    resetButton.addEventListener('click', resetTimer);

    // Config Events
    configButton.addEventListener('click', openConfigModal);
    cancelConfigButton.addEventListener('click', () => configModalOverlay.style.display = 'none');
    saveConfigButton.addEventListener('click', saveConfig);

    // Feedback Modal Events
    if(feedbackTrigger) {
        feedbackTrigger.addEventListener('click', () => {
            if(feedbackText) feedbackText.value = '';
            feedbackModal.style.display = 'flex';
        });
    }
    if(cancelFeedbackBtn) {
        cancelFeedbackBtn.addEventListener('click', () => feedbackModal.style.display = 'none');
    }

    // Task Events
    newTaskText.addEventListener('keypress', e => { if(e.key === 'Enter') addTask(); });
    switchTasks.addEventListener('change', () => { activeList = 'tasks'; renderTasks(); });
    switchExercises.addEventListener('change', () => { activeList = 'exercises'; renderTasks(); });

    // Theme
    themeSwitch.addEventListener('change', toggleTheme);

    // Cookie Accept
    cookieAcceptButton.addEventListener('click', () => {
        setCookie(COOKIE_CONSENT, 'true', 365);
        cookieBanner.style.display = 'none';
        loadTasks();
    });

    // Close Modals on Outside Click
    window.addEventListener('click', (e) => {
        if (e.target === configModalOverlay) configModalOverlay.style.display = 'none';
        if (e.target === feedbackModal) feedbackModal.style.display = 'none';
    });

    // Resize Handler
    window.addEventListener('resize', () => {
        const activeBtn = document.querySelector('.nav-button.active');
        showPanel(activeBtn ? activeBtn.getAttribute('data-panel') : 'panel-tasks');
    });
};