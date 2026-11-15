// ==========================================
// 1. ДАННЫЕ, ПРОФИЛИ И НАСТРОЙКИ
// ==========================================
let profiles = []; // [{ id, name, schedule: [], startDate: 'YYYY-MM-DD' }]
const APP_VERSION = "1.5";
let activeProfileId = null;
let schedule = []; // Ссылка на массив пар активного профиля
let skippedLessons = []; // Формат: ["YYYY-MM-DD_lessonId"]

function getActiveProfile() {
    return profiles.find(p => p.id === activeProfileId) || profiles[0];
}

function saveProfiles() {
    const active = getActiveProfile();
    if (active) {
        active.schedule = schedule;
        active.startDate = appSettings.startDate;
    }
    localStorage.setItem("study_calendar_profiles_v1", JSON.stringify({
        activeProfileId,
        profiles
    }));
    localStorage.setItem("study_calendar_schedule_v2", JSON.stringify(schedule));
}

function saveSchedule() {
    saveProfiles();
}

function renderProfileUI() {
    const wrapper = document.getElementById('header-profile-wrapper');
    const selector = document.getElementById('profile-selector');
    const nameInput = document.getElementById('settings-profile-name');
    const deleteBtn = document.getElementById('btn-delete-profile');
    const active = getActiveProfile();

    const isSingle = profiles.length <= 1;

    // Прячем селектор в шапке, если профиль всего один
    if (wrapper) {
        wrapper.classList.toggle('hidden', isSingle);
    }

    if (selector) {
        selector.innerHTML = profiles.map(p =>
            `<option value="${p.id}" ${p.id === activeProfileId ? 'selected' : ''}>${p.name}</option>`
        ).join('');
    }
    if (nameInput && active) {
        nameInput.value = active.name;
    }
    if (deleteBtn) {
        deleteBtn.classList.toggle('hidden', isSingle);
    }
}

function switchProfile(id) {
    saveProfiles();
    const target = profiles.find(p => p.id === id);
    if (!target) return;

    activeProfileId = target.id;
    schedule = target.schedule || [];
    if (target.startDate) {
        appSettings.startDate = target.startDate;
        const startInput = document.getElementById('settings-start-date');
        if (startInput) startInput.value = appSettings.startDate;
    }

    saveProfiles();
    renderProfileUI();
    updateHeader();
    renderAll();
    showNotification(`Переключено: ${target.name}`);
}

function createNewProfilePrompt(initialSchedule = [], defaultName = "") {
    const name = prompt("Введите название группы или профиля:", defaultName || `Группа ${profiles.length + 1}`);
    if (!name || !name.trim()) return;

    saveProfiles();
    const newProfile = {
        id: 'prof_' + Date.now(),
        name: name.trim(),
        schedule: initialSchedule,
        startDate: appSettings.startDate
    };
    profiles.push(newProfile);
    activeProfileId = newProfile.id;
    schedule = newProfile.schedule;

    saveProfiles();
    renderProfileUI();
    updateHeader();
    renderAll();
    showNotification(`Создано расписание «${newProfile.name}»`);

    if (!document.getElementById('manage-modal').classList.contains('hidden')) {
        openManageModal();
    }
}

function renameCurrentProfile(newName) {
    const trimmed = newName.trim();
    const active = getActiveProfile();
    if (!trimmed || !active) return;

    active.name = trimmed;
    saveProfiles();
    renderProfileUI();
    showNotification("Название обновлено");
}

function deleteCurrentProfile() {
    if (profiles.length <= 1) return;
    const active = getActiveProfile();
    if (!confirm(`Удалить расписание «${active.name}» вместе с парами?`)) return;

    profiles = profiles.filter(p => p.id !== active.id);
    const next = profiles[0];
    activeProfileId = next.id;
    schedule = next.schedule || [];
    if (next.startDate) {
        appSettings.startDate = next.startDate;
        const startInput = document.getElementById('settings-start-date');
        if (startInput) startInput.value = appSettings.startDate;
    }

    saveProfiles();
    renderProfileUI();
    updateHeader();
    renderAll();
    showNotification("Профиль удалён");
    if (!document.getElementById('manage-modal').classList.contains('hidden')) {
        openManageModal();
    }
}

function getDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function loadSkippedLessons() {
    const saved = localStorage.getItem("study_calendar_skipped_v2");
    if (saved) {
        try { skippedLessons = JSON.parse(saved); } catch (e) { skippedLessons = []; }
    }
}

function saveSkippedLessons() {
    localStorage.setItem("study_calendar_skipped_v2", JSON.stringify(skippedLessons));
}

function skipLessonForDate(dateObj, lessonId) {
    const key = `${getDateKey(dateObj)}_${lessonId}`;
    if (!skippedLessons.includes(key)) {
        skippedLessons.push(key);
        saveSkippedLessons();
        renderAll();
        showNotification("Пара скрыта только на этот день");
    }
}

function restoreSkippedForDate(dateObj) {
    const prefix = getDateKey(dateObj) + "_";
    skippedLessons = skippedLessons.filter(k => !k.startsWith(prefix));
    saveSkippedLessons();
    renderAll();
    showNotification("Скрытые пары возвращены");
}
let lessonNotes = {}; // Формат: { "YYYY-MM-DD_lessonId": "Текст ДЗ" }

function loadLessonNotes() {
    const saved = localStorage.getItem("study_calendar_notes_v1");
    if (saved) {
        try { lessonNotes = JSON.parse(saved); } catch (e) { lessonNotes = {}; }
    }
}

function saveLessonNotesToStorage() {
    localStorage.setItem("study_calendar_notes_v1", JSON.stringify(lessonNotes));
}

function getLessonNote(dateObj, lessonId) {
    const val = lessonNotes[`${getDateKey(dateObj)}_${lessonId}`];
    return typeof val === 'string' ? val : "";
}

function openNoteModal(lessonId) {
    const lesson = schedule.find(x => x.id === lessonId);
    if (!lesson) return;

    const currentNote = getLessonNote(selectedCalendarDate, lessonId);
    const dayOfWeek = getRussianDayOfWeek(selectedCalendarDate);

    document.getElementById('note-lesson-id').value = lessonId;
    document.getElementById('note-modal-subject').textContent = lesson.subject;
    document.getElementById('note-modal-date').textContent = `${dayFullNames[dayOfWeek]}, ${selectedCalendarDate.getDate()} ${monthNamesGenitive[selectedCalendarDate.getMonth()]}`;
    document.getElementById('note-textarea').value = currentNote;

    document.getElementById('btn-delete-note').classList.toggle('hidden', !currentNote);
    document.getElementById('note-modal').classList.remove('hidden');

    setTimeout(() => document.getElementById('note-textarea').focus(), 50);
}

function closeNoteModal() {
    document.getElementById('note-modal').classList.add('hidden');
}

function saveLessonNote(e) {
    e.preventDefault();
    const lessonId = document.getElementById('note-lesson-id').value;
    const textarea = document.getElementById('note-textarea');
    const text = textarea ? String(textarea.value).trim() : "";
    const key = `${getDateKey(selectedCalendarDate)}_${lessonId}`;

    if (text) {
        lessonNotes[key] = text;
        showNotification("Заметка сохранена");
    } else {
        delete lessonNotes[key];
    }

    saveLessonNotesToStorage();
    closeNoteModal();
    renderSelectedDay();
}

function deleteLessonNote() {
    const lessonId = document.getElementById('note-lesson-id').value;
    const key = `${getDateKey(selectedCalendarDate)}_${lessonId}`;
    delete lessonNotes[key];
    saveLessonNotesToStorage();
    closeNoteModal();
    renderSelectedDay();
    showNotification("Заметка удалена");
}

let appSettings = {
    theme: 'light',
    startDate: '' // Будет вычислено при старте, если пусто
};

const todayDate = new Date();
let displayMonthDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
let selectedCalendarDate = new Date(todayDate);

const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const monthNamesGenitive = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const dayNamesShort = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const dayFullNames = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

// ==========================================
// 2. ЗАГРУЗКА, СОХРАНЕНИЕ И ТЕМА
// ==========================================
function initApp() {
    loadSettings();
    loadSchedule();
    loadSkippedLessons();
    loadLessonNotes();
    applyTheme();
    updateHeader();
    populateWeekSelect();
    renderAll();
    initCalendarSwipe();
    initWidgetModeIfNeeded();
    checkAppUpdates();
}

function loadSettings() {
    const saved = localStorage.getItem("study_calendar_settings_v2");
    if (saved) {
        try {
            appSettings = { ...appSettings, ...JSON.parse(saved) };
        } catch (e) { }
    }

    // Если дата старта не задана, ставим 1 сентября текущего (или прошлого) уч. года
    if (!appSettings.startDate) {
        const y = todayDate.getMonth() < 7 ? todayDate.getFullYear() - 1 : todayDate.getFullYear();
        appSettings.startDate = `${y}-09-01`;
    }
    document.getElementById('settings-start-date').value = appSettings.startDate;
    document.getElementById('theme-toggle').checked = appSettings.theme === 'dark';
}

function saveSettings() {
    appSettings.startDate = document.getElementById('settings-start-date').value || appSettings.startDate;
    appSettings.theme = document.getElementById('theme-toggle').checked ? 'dark' : 'light';
    localStorage.setItem("study_calendar_settings_v2", JSON.stringify(appSettings));
    saveProfiles();
    applyTheme();
    updateHeader();
    renderAll();
}

function toggleTheme() {
    saveSettings();
}

function applyTheme() {
    const isDark = appSettings.theme === 'dark';
    if (isDark) {
        document.documentElement.classList.add('dark');
        document.getElementById('meta-theme-color').setAttribute('content', '#0f172a'); // slate-950
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('meta-theme-color').setAttribute('content', '#ffffff');
    }
}

function loadSchedule() {
    const savedProfilesRaw = localStorage.getItem("study_calendar_profiles_v1");
    if (savedProfilesRaw) {
        try {
            const parsed = JSON.parse(savedProfilesRaw);
            profiles = parsed.profiles || [];
            activeProfileId = parsed.activeProfileId;
        } catch (e) {
            profiles = [];
        }
    }

    if (profiles.length === 0) {
        let oldSchedule = [];
        const savedOld = localStorage.getItem('study_calendar_schedule_v2');
        if (savedOld) {
            try { oldSchedule = JSON.parse(savedOld); } catch (e) { }
        }
        const defaultProf = {
            id: 'prof_default',
            name: 'Основное',
            schedule: oldSchedule,
            startDate: appSettings.startDate
        };
        profiles = [defaultProf];
        activeProfileId = defaultProf.id;
    }

    const active = getActiveProfile();
    activeProfileId = active.id;
    schedule = active.schedule || [];
    if (active.startDate) {
        appSettings.startDate = active.startDate;
        const startInput = document.getElementById('settings-start-date');
        if (startInput) startInput.value = appSettings.startDate;
    }

    const hash = window.location.hash;
    if (hash.startsWith('#data=')) {
        const rawData = hash.substring(6);
        let parsedData = null;

        try {
            parsedData = parseSharePayload(rawData);
        } catch (e) {
            console.error("Ошибка импорта расписания:", e);
        }

        window.history.replaceState(null, null, window.location.pathname + window.location.search);

        if (parsedData && Array.isArray(parsedData)) {
            const asNew = confirm(
                "Найдено расписание по ссылке!\n\n" +
                "• Нажмите «ОК», чтобы сохранить как НОВУЮ группу (текущее расписание останется нетронутым).\n" +
                "• Нажмите «Отмена», чтобы заменить текущее расписание («" + active.name + "»)."
            );

            if (asNew) {
                const groupName = prompt("Введите название для новой группы:", "Новая группа") || `Группа ${profiles.length + 1}`;
                const newProf = {
                    id: 'prof_' + Date.now(),
                    name: groupName.trim(),
                    schedule: parsedData,
                    startDate: appSettings.startDate
                };
                profiles.push(newProf);
                activeProfileId = newProf.id;
                schedule = newProf.schedule;
            } else {
                active.schedule = parsedData;
                schedule = parsedData;
            }
            saveProfiles();
            showNotification("Расписание загружено!");
        } else {
            alert("Ошибка: не удалось распознать расписание из ссылки.");
        }
    }


    saveProfiles();
    renderProfileUI();
}

// ==========================================
// 3. ЛОГИКА НЕДЕЛЬ ОТ ЗАДАННОЙ ДАТЫ
// ==========================================
function getStartOfWeek(dateStr) {
    const d = new Date(dateStr);
    let day = d.getDay();
    day = day === 0 ? 7 : day;
    d.setDate(d.getDate() - (day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
}

function getAcademicWeek(dateObj) {
    const target = new Date(dateObj);
    target.setHours(0, 0, 0, 0);

    const week1Monday = getStartOfWeek(appSettings.startDate);
    if (target.getTime() < week1Monday.getTime()) return 0; // До начала семестра

    const diffMs = target.getTime() - week1Monday.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) + 1;

    // Если прошло больше 50 недель с начала семестра — считаем, что семестр/год закончился
    if (weekNum > 45) return 0;

    return weekNum;
}

function getRussianDayOfWeek(date) {
    let day = date.getDay();
    return day === 0 ? 7 : day;
}

function isWeekMatching(ruleStr, weekNum) {
    if (weekNum <= 0) return false;
    if (!ruleStr) return true;
    const str = ruleStr.toLowerCase().trim();
    if (["все", "каждую", "*", ""].includes(str)) return true;
    if (["чет", "чёт", "четные", "чётные"].includes(str)) return weekNum % 2 === 0;
    if (["нечет", "нечёт", "нечетные", "нечётные"].includes(str)) return weekNum % 2 !== 0;

    const parts = str.split(",");
    for (let part of parts) {
        part = part.trim().replace(/нед\.?/g, '').trim();
        if (!part) continue;
        if (part.includes("-")) {
            const [start, end] = part.split("-").map(n => parseInt(n.trim(), 10));
            if (!isNaN(start) && !isNaN(end) && weekNum >= start && weekNum <= end) return true;
        } else {
            const num = parseInt(part, 10);
            if (!isNaN(num) && num === weekNum) return true;
        }
    }
    return false;
}

// ==========================================
// 4. РЕНДЕР ИНТЕРФЕЙСА
// ==========================================
function updateHeader() {
    const dayOfWeekStr = dayNamesShort[getRussianDayOfWeek(todayDate) - 1];
    const dateStr = `${dayOfWeekStr}, ${todayDate.getDate()} ${monthNamesGenitive[todayDate.getMonth()].slice(0, 3)}`;

    const currentWeek = getAcademicWeek(todayDate);
    let weekStr = "";
    if (currentWeek === 0) weekStr = "Каникулы";
    else {
        const isEven = currentWeek % 2 === 0;
        weekStr = `${currentWeek} неделя`;
    }

    document.getElementById('compact-header-date').textContent = dateStr;
    document.getElementById('compact-header-week').textContent = weekStr;
}

function selectToday() {
    selectedCalendarDate = new Date(todayDate);
    displayMonthDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    renderAll();
}

function changeMonth(delta) {
    displayMonthDate.setMonth(displayMonthDate.getMonth() + delta);
    renderCalendar();

    const grid = document.getElementById('calendar-grid');
    if (grid) {
        grid.classList.remove('calendar-anim-next', 'calendar-anim-prev');
        void grid.offsetWidth; // Перезапуск CSS-анимации
        grid.classList.add(delta > 0 ? 'calendar-anim-next' : 'calendar-anim-prev');
    }
}

function initCalendarSwipe() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    let startX = 0;
    let startY = 0;

    grid.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    grid.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;

        // Срабатывает, если горизонтальный свайп больше 50px и явно горизонтальнее вертикального скролла
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) {
                changeMonth(1);  // Свайп влево -> следующий месяц
            } else {
                changeMonth(-1); // Свайп вправо -> предыдущий месяц
            }
        }
    }, { passive: true });
}

function onDateClick(dateObj) {
    selectedCalendarDate = new Date(dateObj);
    renderCalendar();
    renderSelectedDay();
}

function getLessonsForDay(date, includeSkipped = false) {
    const dayOfWeek = getRussianDayOfWeek(date);
    if (dayOfWeek === 7) return [];
    const weekNum = getAcademicWeek(date);
    const datePrefix = getDateKey(date) + "_";

    return schedule
        .filter(item => {
            if (item.day !== dayOfWeek || !isWeekMatching(item.weeks, weekNum)) return false;
            if (!includeSkipped && skippedLessons.includes(datePrefix + item.id)) return false;
            return true;
        })
        .sort((a, b) => a.timeStart.localeCompare(b.timeStart));
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const month = displayMonthDate.getMonth();
    const year = displayMonthDate.getFullYear();
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

    // Заголовок дней недели
    const weekHeader = document.createElement('div');
    weekHeader.className = 'calendar-cell bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold text-[0.72rem]';
    weekHeader.textContent = '№';
    grid.appendChild(weekHeader);

    dayNamesShort.forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold text-[0.72rem] py-1';
        cell.textContent = d;
        grid.appendChild(cell);
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() === 0 ? 7 : firstDay.getDay();

    const daysArray = [];
    for (let i = startDay - 1; i > 0; i--) daysArray.push(new Date(year, month, 1 - i));
    for (let i = 1; i <= lastDay.getDate(); i++) daysArray.push(new Date(year, month, i));
    const remaining = 7 - (daysArray.length % 7);
    if (remaining < 7) {
        for (let i = 1; i <= remaining; i++) daysArray.push(new Date(year, month + 1, i));
    }

    let dayIndex = 0;
    const totalWeeks = daysArray.length / 7;

    for (let w = 0; w < totalWeeks; w++) {
        const weekNum = getAcademicWeek(daysArray[dayIndex]);
        const weekCell = document.createElement('div');
        weekCell.className = 'calendar-cell bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold text-[0.72rem]';
        weekCell.textContent = weekNum > 0 ? weekNum : '-';
        grid.appendChild(weekCell);

        for (let d = 0; d < 7; d++) {
            const dayDate = daysArray[dayIndex];
            const cell = document.createElement('div');
            cell.className = 'calendar-cell bg-white dark:bg-slate-900';

            const isCurrentMonth = dayDate.getMonth() === month;
            const isToday = dayDate.toDateString() === todayDate.toDateString();
            const isSelected = dayDate.toDateString() === selectedCalendarDate.toDateString();

            const inner = document.createElement('div');
            inner.textContent = dayDate.getDate();

            if (!isCurrentMonth) cell.classList.add('text-slate-300', 'dark:text-slate-600');

            if (isSelected) {
                inner.className = 'selected-bubble bg-blue-600 text-white';
            } else if (isToday) {
                inner.className = 'today-bubble border-blue-500 text-blue-600 dark:text-blue-400';
            }

            if (getLessonsForDay(dayDate).length > 0 && !isSelected) {
                const dot = document.createElement('div');
                dot.className = 'has-lessons-dot bg-blue-500';
                cell.appendChild(dot);
            }

            cell.appendChild(inner);
            cell.onclick = () => onDateClick(dayDate);
            grid.appendChild(cell);
            dayIndex++;
        }
    }
}

let openedSwipeCard = null; // Ссылка на текущую открытую карточку

function closeOpenedSwipeCard() {
    if (openedSwipeCard) {
        openedSwipeCard.card.style.transform = 'translateX(0)';
        openedSwipeCard.wrapper.classList.remove('swiping');
        openedSwipeCard = null;
    }
}

function renderSelectedDay() {
    const listEl = document.getElementById('day-lessons-list');
    const dayOfWeek = getRussianDayOfWeek(selectedCalendarDate);
    const weekNum = getAcademicWeek(selectedCalendarDate);

    document.getElementById('selected-day-title').textContent = `${dayFullNames[dayOfWeek]}, ${selectedCalendarDate.getDate()} ${monthNamesGenitive[selectedCalendarDate.getMonth()]}`;
    document.getElementById('selected-day-subtitle').textContent = weekNum > 0 ? `${weekNum}-я неделя` : 'Вне семестра';

    const allDayLessons = getLessonsForDay(selectedCalendarDate, true);
    const visibleLessons = getLessonsForDay(selectedCalendarDate, false);
    const skippedCount = allDayLessons.length - visibleLessons.length;

    openedSwipeCard = null;
    listEl.innerHTML = '';

    if (visibleLessons.length === 0) {
        listEl.innerHTML = `
            <div class="py-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p class="text-sm font-semibold text-slate-600 dark:text-slate-400">Нет занятий</p>
            </div>`;
    } else {
        visibleLessons.forEach(l => {
            const noteText = getLessonNote(selectedCalendarDate, l.id);
            const wrapper = document.createElement('div');
            wrapper.className = 'lesson-swipe-wrapper';

            // Красная кнопка под карточкой (срабатывает по тапу в открытом состоянии)
            const bg = document.createElement('button');
            bg.type = 'button';
            bg.className = 'lesson-swipe-bg w-full h-full flex items-center justify-end pr-4 gap-1.5 text-white font-bold text-xs active:brightness-90 transition';
            bg.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Удалить пару</span>
            `;
            bg.addEventListener('click', (e) => {
                e.stopPropagation();
                skipLessonForDate(selectedCalendarDate, l.id);
            });

            // Сама карточка пары 
            const card = document.createElement('div');
            card.className = 'lesson-swipe-card p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col gap-1 shadow-sm group cursor-pointer md:hover:border-blue-300 md:dark:hover:border-blue-700/80 transition-transform duration-200';
            card.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <span class="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                        ${l.timeStart} – ${l.timeEnd}
                    </span>
                    <div class="flex items-center gap-1.5">
                        <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                            нед: ${l.weeks}
                        </span>
                        <button onclick="skipLessonForDate(selectedCalendarDate, '${l.id}')" title="Отменить пару только на этот день"
                            class="hidden md:inline-flex p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug mt-0.5">${l.subject}</div>
                
                <div class="flex items-end justify-between gap-2 mt-1">
                    <div class="flex flex-col items-start gap-y-1 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                        ${l.type ? `<span>${l.type}</span>` : ''}
                        ${l.room ? `<span class="text-amber-700 dark:text-amber-500 font-medium">• ${l.room}</span>` : ''}
                        ${l.teacher ? `<span>• ${l.teacher}</span>` : ''}
                    </div>
                    <span title="${noteText ? 'Редактировать заметку' : 'Добавить заметку'}"
                        class="shrink-0 p-1 rounded-lg transition-colors ${noteText
                    ? 'text-blue-500 dark:text-blue-400 bg-blue-500/10'
                    : 'text-slate-400/70 dark:text-slate-500 md:group-hover:text-blue-500 md:dark:group-hover:text-blue-400 md:group-hover:bg-blue-500/10'}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </span>
                </div>
                ${noteText ? `
                    <div class="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-xs text-blue-700 dark:text-blue-300">
                        <span class="leading-snug whitespace-pre-line break-words">${noteText}</span>
                    </div>
                ` : ''}
            `;

            // Логика свайпа: "стоп-кран" + полный свайп для удаления
            let startX = 0;
            let startY = 0;
            let currentX = 0;
            let baseOffset = 0;
            let isSwiping = false;
            const STOP_OFFSET = -115; // Позиция стоп-крана
            const FULL_SWIPE_THRESHOLD = -180; // Порог полного удаления

            card.addEventListener('touchstart', (e) => {
                if (openedSwipeCard && openedSwipeCard.card !== card) {
                    closeOpenedSwipeCard();
                }

                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                baseOffset = (openedSwipeCard && openedSwipeCard.card === card) ? STOP_OFFSET : 0;
                currentX = baseOffset;
                isSwiping = false;

                card.classList.add('dragging');
            }, { passive: true });

            card.addEventListener('touchmove', (e) => {
                const dx = e.touches[0].clientX - startX;
                const dy = e.touches[0].clientY - startY;

                if (!isSwiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                    isSwiping = true;
                }

                if (isSwiping) {
                    const maxPull = -wrapper.offsetWidth;
                    currentX = Math.min(0, Math.max(baseOffset + dx, maxPull));
                    card.style.transform = `translateX(${currentX}px)`;

                    if (currentX < -10) {
                        wrapper.classList.add('swiping');
                    }

                    // Визуальный сигнал при пересечении порога полного удаления
                    const wasFull = wrapper.classList.contains('full-swipe');
                    const isFull = currentX < FULL_SWIPE_THRESHOLD;
                    if (isFull !== wasFull) {
                        wrapper.classList.toggle('full-swipe', isFull);
                        if (isFull && navigator.vibrate) navigator.vibrate(12);
                    }
                }
            }, { passive: true });

            card.addEventListener('touchend', () => {
                card.classList.remove('dragging');
                wrapper.classList.remove('full-swipe');
                if (!isSwiping) return;

                if (currentX < FULL_SWIPE_THRESHOLD) {
                    // Полный свайп влево -> уводим за экран и удаляем пару
                    card.style.transform = `translateX(-100%)`;
                    openedSwipeCard = null;
                    setTimeout(() => skipLessonForDate(selectedCalendarDate, l.id), 180);
                } else if (currentX < -55) {
                    // Короткий свайп -> фиксируем на стоп-кране (-115px)
                    card.style.transform = `translateX(${STOP_OFFSET}px)`;
                    wrapper.classList.add('swiping');
                    openedSwipeCard = { card, wrapper };
                } else {
                    // Возвращаем на место
                    card.style.transform = 'translateX(0)';
                    wrapper.classList.remove('swiping');
                    if (openedSwipeCard && openedSwipeCard.card === card) {
                        openedSwipeCard = null;
                    }
                }
            });

            card.addEventListener('click', (e) => {
                if (isSwiping || e.target.closest('button')) return;

                // Если карточка открыта на стоп-кране — тап по ней просто закрывает её обратно
                if (openedSwipeCard && openedSwipeCard.card === card) {
                    closeOpenedSwipeCard();
                    return;
                }

                openNoteModal(l.id);
            });

            wrapper.appendChild(bg);
            wrapper.appendChild(card);
            listEl.appendChild(wrapper);
        });
    }

    if (skippedCount > 0) {
        const restoreBtn = document.createElement('button');
        restoreBtn.onclick = () => restoreSkippedForDate(selectedCalendarDate);
        restoreBtn.className = 'w-full mt-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 transition';
        restoreBtn.textContent = `Вернуть скрытые пары (${skippedCount})`;
        listEl.appendChild(restoreBtn);
    }
}

// ==========================================
// 5. ПОЛНАЯ СЕТКА И УПРАВЛЕНИЕ
// ==========================================
function populateWeekSelect() {
    const select = document.getElementById('table-week-select');
    for (let i = 1; i <= 25; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i}-я неделя`;
        select.appendChild(opt);
    }
}

function filterTableByWeek() { renderFullTableView(); }

function renderFullTableView() {
    const container = document.getElementById('full-schedule-container');
    const val = document.getElementById('table-week-select').value;
    let targetWeek = val === 'all' ? null : (val === 'current' ? getAcademicWeek(todayDate) : parseInt(val, 10));

    container.innerHTML = '';
    if (schedule.length === 0) {
        container.innerHTML = `<div class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Расписание пустое. Добавьте пары.</div>`;
        return;
    }

    for (let day = 1; day <= 6; day++) {
        let dayLessons = schedule.filter(item => item.day === day);
        if (targetWeek !== null) dayLessons = dayLessons.filter(item => isWeekMatching(item.weeks, targetWeek));

        if (dayLessons.length === 0 && targetWeek !== null) continue; // Скрываем пустые дни при фильтре

        dayLessons.sort((a, b) => a.timeStart.localeCompare(b.timeStart));
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm';

        let html = `<div class="font-bold text-slate-800 dark:text-slate-200 text-sm pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">${dayFullNames[day]}</div>`;
        if (dayLessons.length === 0) html += `<p class="text-xs text-slate-400 italic">Нет пар</p>`;
        else {
            html += `<div class="space-y-2">` + dayLessons.map(l => `
                        <div class="py-1">
                            <div class="flex justify-between text-xs mb-0.5">
                                <span class="font-bold text-blue-600 dark:text-blue-400">${l.timeStart}-${l.timeEnd}</span>
                                <span class="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">${l.weeks}</span>
                            </div>
                            <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${l.subject}</div>
                            <div class="text-[11px] text-slate-500 dark:text-slate-400">${l.room ? l.room + ' • ' : ''}${l.teacher || ''}</div>
                        </div>
                    `).join('') + `</div>`;
        }
        card.innerHTML = html;
        container.appendChild(card);
    }
}

// ==========================================
// 6. МОДАЛКИ (РЕДАКТИРОВАНИЕ, НАСТРОЙКИ, ШЕЙР)
// ==========================================
function switchTab(tab) {
    document.getElementById('view-calendar').classList.toggle('hidden', tab !== 'calendar');
    document.getElementById('view-table').classList.toggle('hidden', tab !== 'table');
    document.getElementById('tab-calendar-btn').classList.toggle('active', tab === 'calendar');
    document.getElementById('tab-table-btn').classList.toggle('active', tab === 'table');
    if (tab === 'table') renderFullTableView();
}

function openManageModal() {
    renderProfileUI();
    const list = document.getElementById('manage-lessons-list');

    if (schedule.length === 0) {
        list.innerHTML = `
            <div class="py-8 px-4 text-center bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400">В этом расписании пока ничего нет</p>
                <button onclick="closeManageModal(); openShareModal(); setTimeout(() => document.getElementById('import-json-input')?.focus(), 100);"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Импортировать из JSON или ссылки
                </button>
            </div>
        `;
    } else {
        list.innerHTML = '';
        [...schedule].sort((a, b) => a.day !== b.day ? a.day - b.day : a.timeStart.localeCompare(b.timeStart)).forEach(l => {
            const item = document.createElement('div');
            item.className = 'p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs';
            item.innerHTML = `
                <div class="flex-1 pr-2">
                    <div class="font-semibold text-slate-800 dark:text-slate-200">${dayNamesShort[l.day - 1]} • ${l.timeStart} • ${l.subject}</div>
                </div>
                <button onclick="openEditLessonForm('${l.id}')" class="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-blue-600 dark:text-blue-400">Изм.</button>
            `;
            list.appendChild(item);
        });
    }

    document.getElementById('manage-modal').classList.remove('hidden');
}


function closeManageModal() { document.getElementById('manage-modal').classList.add('hidden'); }

function openAddLessonModal() {
    document.getElementById('lesson-form').reset();
    document.getElementById('form-lesson-id').value = "";
    document.getElementById('form-day').value = getRussianDayOfWeek(selectedCalendarDate) <= 6 ? getRussianDayOfWeek(selectedCalendarDate) : "1";
    document.getElementById('btn-delete-lesson').classList.add('hidden');
    document.getElementById('lesson-modal').classList.remove('hidden');
}

function openEditLessonForm(id) {
    const l = schedule.find(x => x.id === id);
    if (!l) return;
    document.getElementById('form-lesson-id').value = l.id;
    document.getElementById('form-day').value = l.day;
    document.getElementById('form-time-start').value = l.timeStart;
    document.getElementById('form-time-end').value = l.timeEnd;
    document.getElementById('form-subject').value = l.subject;
    document.getElementById('form-type').value = l.type || "";
    document.getElementById('form-room').value = l.room || "";
    document.getElementById('form-teacher').value = l.teacher || "";
    document.getElementById('form-weeks').value = l.weeks || "все";
    document.getElementById('btn-delete-lesson').classList.remove('hidden');
    document.getElementById('lesson-modal').classList.remove('hidden');
}
function closeLessonModal() { document.getElementById('lesson-modal').classList.add('hidden'); }

function saveLesson(e) {
    e.preventDefault();
    const id = document.getElementById('form-lesson-id').value;
    const newLesson = {
        id: id || 'id_' + Date.now(),
        day: parseInt(document.getElementById('form-day').value, 10),
        timeStart: document.getElementById('form-time-start').value.trim(),
        timeEnd: document.getElementById('form-time-end').value.trim(),
        subject: document.getElementById('form-subject').value.trim(),
        type: document.getElementById('form-type').value.trim(),
        room: document.getElementById('form-room').value.trim(),
        teacher: document.getElementById('form-teacher').value.trim(),
        weeks: document.getElementById('form-weeks').value.trim()
    };
    if (id) {
        const idx = schedule.findIndex(x => x.id === id);
        if (idx !== -1) schedule[idx] = newLesson;
    } else schedule.push(newLesson);

    saveSchedule();
    closeLessonModal();
    openManageModal();
    renderAll();
}

function deleteCurrentLesson() {
    const id = document.getElementById('form-lesson-id').value;
    if (confirm("Удалить занятие?")) {
        schedule = schedule.filter(x => x.id !== id);
        saveSchedule();
        closeLessonModal();
        openManageModal();
        renderAll();
    }
}
function clearAllSchedule() {
    if (confirm("Удалить ВСЕ пары?")) { schedule = []; saveSchedule(); openManageModal(); renderAll(); }
}

function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

function checkAppUpdates() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('widget') === '1') return;

    const seenVersion = localStorage.getItem("study_calendar_version");
    const hasExistingData = localStorage.getItem("study_calendar_profiles_v1") || localStorage.getItem("study_calendar_schedule_v2");

    if (!seenVersion) {
        if (!hasExistingData) {
            localStorage.setItem("study_calendar_version", APP_VERSION);
            return;
        }
        openUpdatesModal();
    } else if (seenVersion !== APP_VERSION) {
        openUpdatesModal();
    }
}

function openUpdatesModal() {
    document.getElementById('updates-modal').classList.remove('hidden');
}

function closeUpdatesModal() {
    localStorage.setItem("study_calendar_version", APP_VERSION);
    document.getElementById('updates-modal').classList.add('hidden');
}

function openShareModal() {
    document.getElementById('share-modal').classList.remove('hidden');
    document.getElementById('share-toast').classList.add('hidden');
}
function closeShareModal() { document.getElementById('share-modal').classList.add('hidden'); }

// ==========================================
// 7. СИСТЕМА КОПИРОВАНИЯ (FALLBACK)
// ==========================================
function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0"; textArea.style.left = "0"; textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        var successful = document.execCommand('copy');
        if (successful) showToast();
        else prompt("Не удалось скопировать автоматически. Скопируйте ссылку вручную:", text);
    } catch (err) {
        prompt("Не удалось скопировать автоматически. Скопируйте ссылку вручную:", text);
    }
    document.body.removeChild(textArea);
}

function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(showToast, function (err) {
        fallbackCopyTextToClipboard(text);
    });
}

// Кодирование Unicode (русских букв) в Base64
function utoa(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

// Декодирование Base64 обратно в русский текст
function atou(b64) {
    return decodeURIComponent(escape(window.atob(b64)));
}

// Сжатие расписания: используем точные названия полей timeStart и subject
// Сверхкомпактная упаковка: выносим повторяющиеся строки в словарь и убираем лишний синтаксис JSON
function packScheduleCompact(list) {
    const dict = [];
    const getIdx = (val) => {
        const s = (val || "").trim();
        if (!s) return "";
        let idx = dict.indexOf(s);
        if (idx === -1) {
            idx = dict.length;
            dict.push(s);
        }
        return idx.toString(36); // 0-9, a-z
    };

    const rows = list.map(item => [
        item.day,
        item.timeStart.replace(':', ''),
        item.timeEnd.replace(':', ''),
        getIdx(item.subject),
        getIdx(item.type),
        getIdx(item.room),
        getIdx(item.teacher),
        (!item.weeks || item.weeks === "все") ? "" : item.weeks
    ].join('~'));

    return dict.join('|') + '\n' + rows.join(';');
}

function unpackScheduleCompact(str) {
    const nl = str.indexOf('\n');
    if (nl === -1) return [];
    const dictRaw = str.slice(0, nl);
    const rowsRaw = str.slice(nl + 1);
    if (!rowsRaw) return [];

    const dict = dictRaw ? dictRaw.split('|') : [];
    const fromIdx = (code) => code === "" ? "" : (dict[parseInt(code, 36)] || "");
    const fmtTime = (t) => t.length === 4 ? `${t.slice(0, 2)}:${t.slice(2)}` : t;

    return rowsRaw.split(';').map((row, idx) => {
        const p = row.split('~');
        return {
            id: 'id_' + Date.now() + '_' + idx,
            day: parseInt(p[0], 10),
            timeStart: fmtTime(p[1] || ""),
            timeEnd: fmtTime(p[2] || ""),
            subject: fromIdx(p[3]),
            type: fromIdx(p[4]),
            room: fromIdx(p[5]),
            teacher: fromIdx(p[6]),
            weeks: p[7] || "все"
        };
    });
}

function decompressSchedule(arr) {
    return arr.map((item, idx) => {
        const hasId = item.length >= 9;
        const offset = hasId ? 1 : 0;
        return {
            id: hasId ? item[0] : ('id_' + Date.now() + '_' + idx),
            day: item[offset],
            timeStart: item[offset + 1],
            timeEnd: item[offset + 2],
            subject: item[offset + 3],
            type: item[offset + 4] || "",
            room: item[offset + 5] || "",
            teacher: item[offset + 6] || "",
            weeks: item[offset + 7] || "все"
        };
    });
}

function generateShareUrl() {
    const baseUrl = window.location.origin + window.location.pathname;
    try {
        const compactStr = packScheduleCompact(schedule);
        if (window.LZString) {
            const lz = LZString.compressToEncodedURIComponent(compactStr);
            return `${baseUrl}#data=c:${lz}`;
        }
        return `${baseUrl}#data=c0:${encodeURIComponent(utoa(compactStr))}`;
    } catch (e) {
        console.error("Ошибка при генерации ссылки:", e);
        return `${baseUrl}#data=${encodeURIComponent(JSON.stringify(schedule))}`;
    }
}

function parseSharePayload(raw) {
    let clean = raw.trim();
    if (clean.includes('#data=')) {
        clean = clean.split('#data=')[1];
    }

    // 1. Новый сверхкомпактный формат с LZ-сжатием (c:...)
    if (clean.startsWith('c:') && window.LZString) {
        const decompressed = LZString.decompressFromEncodedURIComponent(clean.slice(2));
        if (decompressed) return unpackScheduleCompact(decompressed);
    }

    // 2. Новый сверхкомпактный формат без LZ (c0:...)
    if (clean.startsWith('c0:')) {
        const decoded = atou(decodeURIComponent(clean.slice(3)));
        return unpackScheduleCompact(decoded);
    }

    // 3. Промежуточный LZ формат (z:...)
    if (clean.startsWith('z:') && window.LZString) {
        const decompressed = LZString.decompressFromEncodedURIComponent(clean.slice(2));
        if (decompressed) {
            const json = JSON.parse(decompressed);
            return Array.isArray(json) && Array.isArray(json[0]) ? decompressSchedule(json) : json;
        }
    }

    // 4. Старый Base64 формат
    try {
        const decoded = atou(decodeURIComponent(clean));
        const json = JSON.parse(decoded);
        return Array.isArray(json) && Array.isArray(json[0]) ? decompressSchedule(json) : json;
    } catch (e1) {
        // 5. Обычный JSON
        const json = JSON.parse(clean);
        return Array.isArray(json) && Array.isArray(json[0]) ? decompressSchedule(json) : json;
    }
}

function importFromJsonInput() {
    const raw = document.getElementById('import-json-input').value.trim();
    if (!raw) return;

    let parsed = null;
    try {
        parsed = parseSharePayload(raw);
    } catch (e) {
        console.error("Ошибка парсинга:", e);
    }

    if (Array.isArray(parsed)) {
        if (schedule.length > 0) {
            const replace = confirm(
                `В расписании «${getActiveProfile().name}» уже есть пары (${schedule.length} шт.).\n\n` +
                `• Нажмите «ОК», чтобы ЗАМЕНИТЬ их новым расписанием.\n` +
                `• Нажмите «Отмена», чтобы ДОБАВИТЬ новые пары поверх существующих.`
            );

            if (replace) {
                schedule = parsed;
            } else {
                const withNewIds = parsed.map((item, idx) => ({
                    ...item,
                    id: 'id_' + Date.now() + '_' + idx
                }));
                schedule = [...schedule, ...withNewIds];
            }
        } else {
            schedule = parsed;
        }

        saveSchedule();
        renderAll();
        closeShareModal();
        document.getElementById('import-json-input').value = '';
        showNotification("Расписание успешно загружено!");
    } else {
        alert("Ошибка формата: проверьте вставленный код или ссылку.");
    }
}


function copyShareLink() {
    const url = generateShareUrl();
    copyTextToClipboard(url);
}
function copyBackupLinkFromSettings() {
    const url = generateShareUrl();
    copyTextToClipboard(url);
    showNotification("Ссылка скопирована! Сохраните её");
}


function showToast() { document.getElementById('share-toast').classList.remove('hidden'); }

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = "fixed bottom-5 left-1/2 -translate-x-1/2 w-max max-w-[90vw] text-center bg-slate-900/90 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-4 py-2.5 rounded-full shadow-lg z-50 backdrop-blur-sm transition-all";
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function renderAll() {
    renderCalendar();
    renderSelectedDay();
    renderFullTableView();
}


function initWidgetModeIfNeeded() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('widget') !== '1') return;

    // Принудительно выбираем сегодняшний день
    selectedCalendarDate = new Date();
    renderAll();

    // Прячем всё лишнее, оставляем только блок с парами на сегодня
    document.body.innerHTML = '';
    document.body.className = 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 select-none';

    const weekNum = getAcademicWeek(selectedCalendarDate);
    const dayOfWeek = getRussianDayOfWeek(selectedCalendarDate);
    const lessons = getLessonsForDay(selectedCalendarDate);
    const nowMinutes = selectedCalendarDate.getHours() * 60 + selectedCalendarDate.getMinutes();

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-2';
    header.innerHTML = `
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            ${dayFullNames[dayOfWeek]}, ${selectedCalendarDate.getDate()} ${monthNamesGenitive[selectedCalendarDate.getMonth()]}
        </span>
        <span class="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">
            ${weekNum > 0 ? weekNum + ' неделя' : 'Каникулы'}
        </span>
    `;
    document.body.appendChild(header);

    if (lessons.length === 0) {
        document.body.innerHTML += `<div class="py-6 text-center text-sm font-semibold text-slate-400">Сегодня пар нет</div>`;
        return;
    }

    const list = document.createElement('div');
    list.className = 'space-y-2';

    lessons.forEach((l, idx) => {
        const [sh, sm] = l.timeStart.split(':').map(Number);
        const startMin = (sh || 0) * 60 + (sm || 0);
        const endMin = l.timeEnd ? l.timeEnd.split(':').map(Number).reduce((h, m) => h * 60 + m) : startMin + 90;
        const isPast = nowMinutes > endMin;
        const isCurrent = !isPast && (idx === 0 || nowMinutes > endMin - 90);

        const row = document.createElement('div');
        row.className = 'flex items-center gap-2.5';
        row.innerHTML = `
            <div class="w-1 h-8 rounded-full ${isCurrent ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}"></div>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-bold truncate ${isPast ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}">${l.subject}</div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    ${l.timeStart}${l.timeEnd ? '–' + l.timeEnd : ''} ${l.room ? ' • ' + l.room : ''}
                </div>
            </div>
        `;
        list.appendChild(row);
    });

    document.body.appendChild(list);
}


window.onload = initApp;