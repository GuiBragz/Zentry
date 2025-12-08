document.addEventListener('DOMContentLoaded', () => {
    // =======================================
    // 1. Configurações e Variáveis
    // =======================================
    const COOKIE_CONSENT = 'zentry_cookie_accepted';
    const CONFIG_COOKIE = 'zentry_pomodoro_config';
    const THEME_COOKIE = 'zentry_theme';

    let config = { focusTime: 25, shortBreak: 5, longBreak: 15, sessionsBeforeLongBreak: 4 };
    let mode = 'focus'; 
    let timeLeft = config.focusTime * 60; 
    let isRunning = false;
    let timerInterval;
    let currentSession = 1;
    let tasks = [];
    let exercises = [];
    let activeList = 'tasks'; 

    const alarmSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    const STATUS_OPEN = 'open';
    const STATUS_IN_PROGRESS = 'in-progress';
    const STATUS_COMPLETED = 'completed';

    // --- Elementos do DOM ---
    const timerDisplay = document.getElementById('timer-display');
    const timerStatus = document.getElementById('timer-status');
    const startButton = document.getElementById('start-button');
    const pauseButton = document.getElementById('pause-button');
    const resetButton = document.getElementById('reset-button');
    const currentSessionSpan = document.getElementById('current-session');
    const totalSessionsSpan = document.getElementById('total-sessions');
    const taskList = document.getElementById('task-list');
    const newTaskText = document.getElementById('new-task-text');
    const taskPanelTitle = document.getElementById('task-panel-title');
    const switchTasks = document.getElementById('switch-tasks');
    const switchExercises = document.getElementById('switch-exercises');
    
    // Modais
    const configModalOverlay = document.getElementById('config-modal-overlay');
    const configButton = document.getElementById('config-button');
    const saveConfigButton = document.getElementById('save-config-button');
    const cancelConfigButton = document.getElementById('cancel-config-button');
    
    const feedbackTrigger = document.getElementById('feedback-trigger');
    const feedbackModal = document.getElementById('feedback-modal-overlay');
    const cancelFeedbackBtn = document.getElementById('cancel-feedback-button');
    // Nota: O botão "Enviar" do feedback é controlado pelo HTML <form>

    const cookieBanner = document.getElementById('cookie-banner');
    const cookieAcceptButton = document.getElementById('cookie-accept-button');
    const themeSwitch = document.getElementById('nav-theme-switch');
    const navButtons = document.querySelectorAll('.nav-button');
    const projectIntro = document.querySelector('.project-intro');

    // =======================================
    // 2. Lógica de Feedback (CORREÇÃO AQUI)
    // =======================================
    if (feedbackTrigger && feedbackModal) {
        feedbackTrigger.addEventListener('click', (e) => {
            e.preventDefault(); // Previne comportamentos padrão
            // Limpa o campo se existir
            const textArea = document.getElementById('feedback-text');
            if(textArea) textArea.value = ''; 
            
            // Força a abertura
            feedbackModal.style.display = 'flex';
        });

        if (cancelFeedbackBtn) {
            cancelFeedbackBtn.addEventListener('click', () => {
                feedbackModal.style.display = 'none';
            });
        }
        
        // Fecha ao clicar fora (fundo escuro)
        feedbackModal.addEventListener('click', (e) => {
            if (e.target === feedbackModal) {
                feedbackModal.style.display = 'none';
            }
        });
    } else {
        console.error("Erro: Botão de Feedback ou Modal não encontrados no HTML.");
    }

    // =======================================
    // 3. Cookies e Temas
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
        const isDark = getCookie(THEME_COOKIE) === 'dark' || !getCookie(THEME_COOKIE);
        document.body.className = isDark ? 'dark' : 'light';
        if(themeSwitch) themeSwitch.checked = isDark;
    }

    function toggleTheme() {
        const isDark = document.body.className === 'dark';
        document.body.className = isDark ? 'light' : 'dark';
        if (getCookie(COOKIE_CONSENT) === 'true') setCookie(THEME_COOKIE, isDark ? 'light' : 'dark', 365);
        if(themeSwitch) themeSwitch.checked = !isDark;
    }

    // =======================================
    // 4. Pomodoro
    // =======================================
    function updateDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if(timerDisplay) timerDisplay.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        let statusText = (mode === 'focus') ? 'FOCO' : 'PAUSA';
        if(timerStatus) {
            timerStatus.textContent = statusText;
            timerStatus.className = (mode === 'focus') ? 'timer-mode' : 'timer-mode break-mode';
        }
        document.title = `(${minutes}:${seconds < 10 ? '0' : ''}${seconds}) Zentry`;
    }

    function startTimer() {
        if (isRunning) return; 
        isRunning = true;
        if(timerDisplay) timerDisplay.classList.remove('timer-alarm');
        if(startButton) startButton.style.display = 'none'; 
        if(pauseButton) pauseButton.style.display = 'inline-block';
        
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
        if(startButton) startButton.style.display = 'inline-block'; 
        if(pauseButton) pauseButton.style.display = 'none';
    }

    function resetTimer() {
        pauseTimer(); 
        mode = 'focus'; 
        currentSession = 1; 
        if(timerDisplay) timerDisplay.classList.remove('timer-alarm');
        updateTimerMode(); 
        if(startButton) startButton.style.display = 'inline-block'; 
        if(pauseButton) pauseButton.style.display = 'none';
    }

    function handleTimerEnd() {
        alarmSound.play().catch(e => console.log("Audio bloqueado pelo navegador"));
        if(timerDisplay) timerDisplay.classList.add('timer-alarm');

        if (mode === 'focus') {
            currentSession++; 
            mode = (currentSession > config.sessionsBeforeLongBreak) ? 'longBreak' : 'shortBreak';
            if (mode === 'longBreak') currentSession = 1;
        } else {
            mode = 'focus';
        }
        updateTimerMode();
        isRunning = false; 
        if(startButton) startButton.style.display = 'inline-block'; 
        if(pauseButton) pauseButton.style.display = 'none';
    }

    function updateTimerMode() {
        let newTime = (mode === 'focus') ? config.focusTime : (mode === 'shortBreak' ? config.shortBreak : config.longBreak);
        timeLeft = newTime * 60;
        if(currentSessionSpan) currentSessionSpan.textContent = currentSession;
        if(totalSessionsSpan) totalSessionsSpan.textContent = config.sessionsBeforeLongBreak;
        updateDisplay();
    }

    // =======================================
    // 5. Tarefas
    // =======================================
    function getActiveList() { return activeList === 'tasks' ? tasks : exercises; }

    function renderTasks() {
        if(!taskList) return;
        taskList.innerHTML = '';
        const list = getActiveList();
        const canHaveSubtasks = (activeList === 'tasks');
        
        if(taskPanelTitle) taskPanelTitle.textContent = canHaveSubtasks ? 'Lista de Tarefas (Z-Cards)' : 'Exercícios';

        list.forEach((masterTask, index) => {
            const masterLi = document.createElement('li');
            masterLi.className = `task-item master-task ${masterTask.status}`; 
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'task-header';

            const minimizeButton = document.createElement('button');
            minimizeButton.className = 'minimize-button';
            minimizeButton.textContent = masterTask.minimized ? '▶' : '▼';
            minimizeButton.onclick = (e) => { e.stopPropagation(); toggleMinimize(index); };
            
            const addSubtaskButton = document.createElement('button');
            addSubtaskButton.className = 'add-subtask-button';
            addSubtaskButton.innerHTML = '+'; 
            addSubtaskButton.onclick = (e) => { e.stopPropagation(); addSubtaskPrompt(index); };
            
            if (!canHaveSubtasks) {
                addSubtaskButton.style.display = 'none';
                minimizeButton.style.visibility = 'hidden';
            }
            
            const taskTextSpan = document.createElement('span');
            taskTextSpan.className = 'task-text';
            taskTextSpan.textContent = masterTask.text;

            const statusSelect = document.createElement('select');
            statusSelect.className = 'status-select';
            statusSelect.innerHTML = `
                <option value="${STATUS_OPEN}" ${masterTask.status === STATUS_OPEN ? 'selected' : ''}>Aberto</option>
                <option value="${STATUS_IN_PROGRESS}" ${masterTask.status === STATUS_IN_PROGRESS ? 'selected' : ''}>Andamento</option>
                <option value="${STATUS_COMPLETED}" ${masterTask.status === STATUS_COMPLETED ? 'selected' : ''}>Concluída</option>
            `;
            statusSelect.onclick = (e) => e.stopPropagation(); 
            statusSelect.onchange = (e) => { updateTaskStatus(index, e.target.value); };

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'x';
            deleteButton.className = 'delete-btn';
            deleteButton.onclick = (e) => { e.stopPropagation(); deleteTask(index); };
            
            headerDiv.appendChild(minimizeButton);
            if (canHaveSubtasks) headerDiv.appendChild(addSubtaskButton); 
            headerDiv.appendChild(taskTextSpan);
            headerDiv.appendChild(statusSelect);
            headerDiv.appendChild(deleteButton);
            masterLi.appendChild(headerDiv);

            if (canHaveSubtasks && !masterTask.minimized && masterTask.subtasks && masterTask.subtasks.length > 0) {
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
                    subStatusSelect.onchange = (e) => { updateSubTaskStatus(index, subIndex, e.target.value); };
                    
                    const subDeleteButton = document.createElement('button');
                    subDeleteButton.textContent = 'x';
                    subDeleteButton.className = 'delete-btn';
                    subDeleteButton.onclick = (e) => { e.stopPropagation(); deleteSubTask(index, subIndex); };

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
        if (getCookie(COOKIE_CONSENT) !== 'true') { alert('Permita os cookies.'); return; }
        const list = getActiveList();
        list.push({ text: text, status: STATUS_OPEN, minimized: false, subtasks: [] }); 
        newTaskText.value = '';
        renderTasks();
    }

    window.addSubtaskPrompt = function(masterIndex) {
        const list = getActiveList();
        const subtext = prompt("Nova subtarefa:");
        if (subtext) {
            list[masterIndex].subtasks.push({ text: subtext, status: STATUS_OPEN });
            list[masterIndex].minimized = false;
            renderTasks();
        }
    };

    window.deleteTask = function(i) { getActiveList().splice(i, 1); renderTasks(); };
    window.updateTaskStatus = function(i, s) { const l = getActiveList(); if(l[i]) l[i].status = s; renderTasks(); };
    window.toggleMinimize = function(i) { const l = getActiveList(); if(l[i]) l[i].minimized = !l[i].minimized; renderTasks(); };
    window.updateSubTaskStatus = function(mi, si, s) { const l = getActiveList(); if(l[mi] && l[mi].subtasks[si]) l[mi].subtasks[si].status = s; renderTasks(); };
    window.deleteSubTask = function(mi, si) { const l = getActiveList(); if(l[mi] && l[mi].subtasks[si]) l[mi].subtasks.splice(si, 1); renderTasks(); };

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

    function switchList(type) { activeList = type; renderTasks(); }

    // =======================================
    // 6. Mobile & Utils
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

    function handleCookieConsent() {
        if(!cookieBanner) return;
        if (getCookie(COOKIE_CONSENT) === 'true') cookieBanner.style.display = 'none';
        else cookieBanner.style.display = 'flex';
    }

    // =======================================
    // 7. Configuração Modal e Init
    // =======================================
    function loadConfig() {
        const saved = getCookie(CONFIG_COOKIE);
        if (saved) { try { config = { ...config, ...JSON.parse(saved) }; } catch (e) {} }
    }

    function saveConfig() {
        const f = parseInt(document.getElementById('focus-time-input').value);
        const s = parseInt(document.getElementById('short-break-input').value);
        const l = parseInt(document.getElementById('long-break-input').value);

        if (f > 0 && s > 0 && l > 0) {
            config = { ...config, focusTime: f, shortBreak: s, longBreak: l };
            if (getCookie(COOKIE_CONSENT) === 'true') {
                 setCookie(CONFIG_COOKIE, JSON.stringify(config), 365);
            }
            resetTimer(); 
            if(configModalOverlay) configModalOverlay.style.display = 'none';
        } else {
            alert('Valores inválidos');
        }
    }

    // --- EVENT LISTENERS FINAIS ---
    if(startButton) startButton.addEventListener('click', startTimer);
    if(pauseButton) pauseButton.addEventListener('click', pauseTimer);
    if(resetButton) resetButton.addEventListener('click', resetTimer);
    if(newTaskText) newTaskText.addEventListener('keypress', e => { if(e.key === 'Enter') addTask(); });
    if(switchTasks) switchTasks.addEventListener('change', () => switchList('tasks'));
    if(switchExercises) switchExercises.addEventListener('change', () => switchList('exercises'));
    if(themeSwitch) themeSwitch.addEventListener('change', toggleTheme);
    
    if(cookieAcceptButton) {
        cookieAcceptButton.addEventListener('click', () => {
            setCookie(COOKIE_CONSENT, 'true', 365);
            cookieBanner.style.display = 'none';
            loadTasks();
        });
    }

    if(configButton) {
        configButton.addEventListener('click', () => {
            document.getElementById('focus-time-input').value = config.focusTime;
            document.getElementById('short-break-input').value = config.shortBreak;
            document.getElementById('long-break-input').value = config.longBreak;
            configModalOverlay.style.display = 'flex';
        });
    }
    if(cancelConfigButton) cancelConfigButton.addEventListener('click', () => configModalOverlay.style.display = 'none');
    if(saveConfigButton) saveConfigButton.addEventListener('click', saveConfig);

    // Fecha modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === configModalOverlay) configModalOverlay.style.display = 'none';
    });

    window.addEventListener('resize', () => {
        const activeBtn = document.querySelector('.nav-button.active');
        showPanel(activeBtn ? activeBtn.getAttribute('data-panel') : 'panel-tasks');
    });

    // Inicia tudo
    handleCookieConsent();
    loadConfig();
    loadTheme();
    loadTasks();
    updateTimerMode(); 
    setupMobileNavigation();
});