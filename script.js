// Firebase SDK & Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnvk-nN6gRaT1TL7_dfLPvcclO7P7jWwo",
  authDomain: "noona-todo-backend-223de.firebaseapp.com",
  projectId: "noona-todo-backend-223de",
  storageBucket: "noona-todo-backend-223de.firebasestorage.app",
  messagingSenderId: "300180366477",
  appId: "1:300180366477:web:f27b70dc42070fb14b6ec4",
  measurementId: "G-CHVFG2B4V7", 
  databaseURL: "https://noona-todo-backend-223de-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, "timetable_data");

// Configuration & State
const periods = [
    { num: 1, start: '08:40', end: '09:30' },
    { num: 2, start: '09:40', end: '10:30' },
    { num: 3, start: '10:40', end: '11:30' },
    { num: 4, start: '11:40', end: '12:30' },
    { num: '점심', start: '12:30', end: '13:30', isLunch: true },
    { num: 5, start: '13:40', end: '14:30' },
    { num: 6, start: '14:40', end: '15:30' },
    { num: 7, start: '15:40', end: '16:30' }
];

let masterSubjects = [];
let masterGroups = [];
let timetableData = {}; 

const timetableBody = document.getElementById('timetable-body');
const subjectPool = document.getElementById('subject-pool');
const groupPool = document.getElementById('group-pool');
const subjectChecklist = document.getElementById('subject-checklist');
const createForm = document.getElementById('create-subject-form');
const trashZone = document.getElementById('trash-zone');
const createGroupBtn = document.getElementById('create-group-btn');

async function init() {
    // Initial load from Realtime Database
    try {
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            masterSubjects = data.masterSubjects || [];
            masterGroups = data.masterGroups || [];
            timetableData = data.timetableData || {};
        } else {
            // Default data if new
            masterSubjects = [
                { id: 'math', name: '수학', teacher: '이교사', room: '101호', color: '#f68d7a' },
                { id: 'eng', name: '영어', teacher: '박교사', room: '202호', color: '#7ccab5' },
                { id: 'sci', name: '과학', teacher: '최교사', room: '과학실', color: '#769be3' }
            ];
            await set(dbRef, { masterSubjects, masterGroups: [], timetableData: {} });
        }
        renderAll();
    } catch (err) {
        console.error("Error loading from Firebase Realtime DB:", err);
    }

    // Real-time synchronization
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            masterSubjects = data.masterSubjects || [];
            masterGroups = data.masterGroups || [];
            timetableData = data.timetableData || {};
            renderAll();
        }
    });

    setupDragEvents();
}

function renderAll() {
    renderGrid();
    renderSubjectPool();
    renderGroupPool();
    renderSubjectChecklist();
}

function renderGrid() {
    timetableBody.innerHTML = '';
    periods.forEach((p) => {
        const tr = document.createElement('tr');
        if (p.isLunch) tr.className = 'lunch-row';

        const sideTd = document.createElement('td');
        sideTd.className = 'sidebar-cell';
        sideTd.innerHTML = `
            <span class="period-num">${p.num}${typeof p.num === 'number' ? '교시' : ''}</span>
            <span class="period-time">${p.start}</span>
        `;
        tr.appendChild(sideTd);

        if (p.isLunch) {
            const lunchTd = document.createElement('td');
            lunchTd.colSpan = 5;
            lunchTd.innerHTML = `<div class="lunch-content"><span>🍱</span><span class="lunch-text">맛있는 점심 시간!</span><span>😋</span></div>`;
            tr.appendChild(lunchTd);
        } else {
            for (let day = 0; day < 5; day++) {
                const td = document.createElement('td');
                td.className = 'drop-zone';
                td.dataset.day = day;
                td.dataset.period = p.num;
                const cellKey = `${day}-${p.num}`;
                const cellValue = timetableData[cellKey];
                
                if (cellValue) {
                    if (typeof cellValue === 'object' && cellValue.isGroup) {
                        td.appendChild(renderGroupedBlock(cellValue, cellKey));
                    } else {
                        const subject = masterSubjects.find(s => s.id === cellValue);
                        if (subject) td.appendChild(createPlacedBlock(subject, cellKey));
                    }
                }
                tr.appendChild(td);
            }
        }
        timetableBody.appendChild(tr);
    });
    setupGridDropZones();
}

function renderGroupedBlock(groupData, cellKey) {
    const container = document.createElement('div');
    container.className = 'subject-group-container';
    container.draggable = true; // Enable dragging for the entire group

    container.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', 'moveGroup');
        e.dataTransfer.setData('sourceKey', cellKey);
    });

    const count = groupData.subjects.length;
    if (count > 1) {
        container.style.gridTemplateColumns = '1fr 1fr';
        if (count > 2) container.style.gridTemplateRows = '1fr 1fr';
    }

    if (groupData.groupName) {
        const header = document.createElement('div');
        header.className = 'subject-group-header';
        header.textContent = groupData.groupName;
        container.appendChild(header);
    }

    groupData.subjects.forEach(subjId => {
        const subject = masterSubjects.find(s => s.id === subjId);
        if (subject) {
            const card = document.createElement('div');
            card.className = 'mini-subject-card';
            card.style.backgroundColor = subject.color;
            card.innerHTML = `<div class="m-name">${subject.name}</div><div class="m-teacher">${subject.teacher || ''}</div>`;
            card.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`${subject.name}을(를) 이동 수업에서 제외할까요?`)) {
                    groupData.subjects = groupData.subjects.filter(id => id !== subjId);
                    if (groupData.subjects.length === 1) timetableData[cellKey] = groupData.subjects[0];
                    else if (groupData.subjects.length === 0) delete timetableData[cellKey];
                    saveAndRender();
                }
            };
            container.appendChild(card);
        }
    });
    return container;
}

function renderSubjectPool() {
    subjectPool.innerHTML = '';
    masterSubjects.forEach(subject => {
        const div = document.createElement('div');
        div.className = 'draggable-subject';
        div.draggable = true;
        div.style.backgroundColor = subject.color;
        div.textContent = subject.name;
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('subjectId', subject.id);
            e.dataTransfer.setData('type', 'new');
        });
        subjectPool.appendChild(div);
    });
}

function renderGroupPool() {
    groupPool.innerHTML = '';
    masterGroups.forEach(group => {
        const div = document.createElement('div');
        div.className = 'draggable-group';
        div.draggable = true;
        div.textContent = `${group.name} (${group.subjects.length})`;
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('groupId', group.id);
            e.dataTransfer.setData('type', 'groupDrag');
        });
        groupPool.appendChild(div);
    });
}

function renderSubjectChecklist() {
    subjectChecklist.innerHTML = '';
    masterSubjects.forEach(subj => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${subj.id}"> ${subj.name}`;
        subjectChecklist.appendChild(label);
    });
}

function createPlacedBlock(subject, cellKey) {
    const block = document.createElement('div');
    block.className = 'course-block';
    block.draggable = true;
    block.style.backgroundColor = subject.color;
    block.innerHTML = `<div class="name">${subject.name}</div><div class="info">${subject.teacher || ''} ${subject.room ? '['+subject.room+']' : ''}</div>`;
    block.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', 'move');
        e.dataTransfer.setData('sourceKey', cellKey);
        e.dataTransfer.setData('subjectId', subject.id);
    });
    block.onclick = () => {
        if(confirm(`${subject.name} 수업을 삭제하시겠습니까?`)) {
            delete timetableData[cellKey];
            saveAndRender();
        }
    };
    return block;
}

function setupGridDropZones() {
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const type = e.dataTransfer.getData('type');
            const targetKey = `${zone.dataset.day}-${zone.dataset.period}`;

            if (type === 'groupDrag') {
                const groupId = e.dataTransfer.getData('groupId');
                const group = masterGroups.find(g => g.id === groupId);
                if (group) {
                    timetableData[targetKey] = { 
                        isGroup: true, 
                        groupName: group.name, 
                        subjects: [...group.subjects],
                        originGroupId: group.id // Track the source group
                    };
                }
            } else if (type === 'moveGroup') {
                const sourceKey = e.dataTransfer.getData('sourceKey');
                if (sourceKey !== targetKey) {
                    timetableData[targetKey] = JSON.parse(JSON.stringify(timetableData[sourceKey]));
                    delete timetableData[sourceKey];
                }
            } else {
                const subjectId = e.dataTransfer.getData('subjectId');
                if (type === 'move') {
                    const sourceKey = e.dataTransfer.getData('sourceKey');
                    if (sourceKey !== targetKey) delete timetableData[sourceKey];
                }
                const existing = timetableData[targetKey];
                if (existing) {
                    if (confirm("이동수업(선택 과목)으로 추가하시겠습니까? (취소 시 교체)")) {
                        if (typeof existing === 'object' && existing.isGroup) {
                            if (!existing.subjects.includes(subjectId)) existing.subjects.push(subjectId);
                        } else {
                            timetableData[targetKey] = { isGroup: true, groupName: prompt("그룹 이름", "선택 수업") || "이동 수업", subjects: [existing, subjectId] };
                        }
                    } else { timetableData[targetKey] = subjectId; }
                } else { timetableData[targetKey] = subjectId; }
            }
            saveAndRender();
        });
    });
}

function setupDragEvents() {
    trashZone.addEventListener('dragover', e => { e.preventDefault(); trashZone.classList.add('drag-over'); });
    trashZone.addEventListener('dragleave', () => trashZone.classList.remove('drag-over'));
    trashZone.addEventListener('drop', e => {
        e.preventDefault();
        trashZone.classList.remove('drag-over');
        const type = e.dataTransfer.getData('type');
        if (type === 'move' || type === 'moveGroup') {
            const sourceKey = e.dataTransfer.getData('sourceKey');
            delete timetableData[sourceKey];
        } else if (type === 'groupDrag') {
            const groupId = e.dataTransfer.getData('groupId');
            masterGroups = masterGroups.filter(g => g.id !== groupId);
            // Cascading delete: Remove all instances of this group from timetable
            Object.keys(timetableData).forEach(key => {
                const entry = timetableData[key];
                if (typeof entry === 'object' && entry.isGroup && entry.originGroupId === groupId) {
                    delete timetableData[key];
                }
            });
            renderGroupPool();
        } else {
            const subjectId = e.dataTransfer.getData('subjectId');
            masterSubjects = masterSubjects.filter(s => s.id !== subjectId);
            // Cascading delete: Remove all instances of this subject from timetable
            Object.keys(timetableData).forEach(key => {
                const entry = timetableData[key];
                if (entry === subjectId) {
                    delete timetableData[key];
                } else if (typeof entry === 'object' && entry.isGroup) {
                    entry.subjects = entry.subjects.filter(id => id !== subjectId);
                    if (entry.subjects.length === 0) delete timetableData[key];
                    else if (entry.subjects.length === 1) timetableData[key] = entry.subjects[0];
                }
            });
            renderSubjectPool(); renderSubjectChecklist();
        }
        saveAndRender();
    });
}

createForm.onsubmit = (e) => {
    e.preventDefault();
    const newSubj = { id: 'subj-' + Date.now(), name: document.getElementById('subj-name').value, teacher: document.getElementById('subj-teacher').value, room: document.getElementById('subj-room').value, color: document.getElementById('subj-color').value };
    masterSubjects.push(newSubj);
    renderSubjectPool(); renderSubjectChecklist(); saveAndRender(); createForm.reset();
};

createGroupBtn.onclick = () => {
    const selected = Array.from(subjectChecklist.querySelectorAll('input:checked')).map(i => i.value);
    const name = document.getElementById('group-name').value;
    if (selected.length < 2 || !name) { alert('그룹명과 최소 2개 이상의 과목을 선택하세요.'); return; }
    masterGroups.push({ id: 'group-' + Date.now(), name, subjects: selected });
    renderGroupPool(); saveAndRender();
    document.getElementById('group-name').value = '';
    subjectChecklist.querySelectorAll('input').forEach(i => i.checked = false);
};

async function saveAndRender() {
    try {
        await set(dbRef, {
            masterSubjects,
            masterGroups,
            timetableData
        });
        // renderAll() will be triggered by onValue automatically
    } catch (err) {
        console.error("Error saving to Firebase Realtime DB:", err);
    }
}

init();
