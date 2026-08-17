const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startBtn = document.getElementById('start-btn');
const rankingBody = document.getElementById('ranking-body');
const diffModal = document.getElementById('difficulty-modal');
const diffBadge = document.getElementById('diff-badge');
const openDiffBtn = document.getElementById('open-diff-btn');
const playerNameInput = document.getElementById('player-name-input');
const nameInputSection = document.getElementById('name-input-section');
const modalTitle = document.getElementById('modal-title');

const gridSize = 25;
const tileCount = canvas.width / gridSize;

let snake = [{ x: 10, y: 10 }];
let food = { x: 15, y: 15 };
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;
let score = 0;
let gameInterval;
let gameActive = false;
let promptTimeout;

let currentIntervalMs = 120;
let pointsPerFood = 10;
let playerName = localStorage.getItem('snake_player_name') || '';
let gameDifficulty = 'normal';

function syncNameInputState() {
    if (playerName && playerName.trim() !== '') {
        if (nameInputSection) nameInputSection.style.display = 'none';
        if (modalTitle) modalTitle.textContent = '⚡ Cambiar Nivel';
    } else {
        if (nameInputSection) nameInputSection.style.display = 'block';
        if (playerNameInput) playerNameInput.value = '';
        if (modalTitle) modalTitle.textContent = '🐍 ¡A Jugar!';
    }
}

syncNameInputState();

function applyDifficulty(diff) {
    if (diff === 'easy') { 
        currentIntervalMs = 180; 
        pointsPerFood = 5; 
        if (diffBadge) {
            diffBadge.textContent = 'Fácil';
            diffBadge.style.color = '#81c784'; // Verde
        }
    } else if (diff === 'hard') { 
        currentIntervalMs = 70; 
        pointsPerFood = 15; 
        if (diffBadge) {
            diffBadge.textContent = 'Difícil';
            diffBadge.style.color = '#e24e4e'; // Rojo
        }
    } else { 
        currentIntervalMs = 120; 
        pointsPerFood = 10; 
        if (diffBadge) {
            diffBadge.textContent = 'Normal';
            diffBadge.style.color = '#f6e165'; // Amarillo
        }
    }

    if (gameActive && gameInterval) {
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, currentIntervalMs);
    }
}

function showFloatingPoints(pts) {
    const scoreContainer = document.querySelector('.snake-score');
    if (!scoreContainer) return;

    const floatEl = document.createElement('div');
    floatEl.className = 'floating-point';
    floatEl.textContent = `+${pts}`;
    scoreContainer.appendChild(floatEl);

    scoreElement.classList.remove('score-bump');
    void scoreElement.offsetWidth;
    scoreElement.classList.add('score-bump');

    setTimeout(() => {
        floatEl.remove();
    }, 550);
}

function setDifficultyAndName(diff) {
    // Solo actualizar el nombre si la sección de nombre es visible (no oculta)
    if (nameInputSection && nameInputSection.style.display !== 'none' && playerNameInput) {
        const rawName = playerNameInput.value.trim();
        playerName = rawName !== '' ? rawName.substring(0, 15) : 'Jugador';
        localStorage.setItem('snake_player_name', playerName);
    } else if (!playerName) {
        playerName = 'Jugador';
        localStorage.setItem('snake_player_name', playerName);
    }
    syncNameInputState();

    gameDifficulty = diff;
    applyDifficulty(diff);

    if (diffModal) diffModal.classList.remove('active');
}

const btnEasy = document.getElementById('btn-easy');
const btnNormal = document.getElementById('btn-normal');
const btnHard = document.getElementById('btn-hard');

if (btnEasy) btnEasy.addEventListener('click', () => setDifficultyAndName('easy'));
if (btnNormal) btnNormal.addEventListener('click', () => setDifficultyAndName('normal'));
if (btnHard) btnHard.addEventListener('click', () => setDifficultyAndName('hard'));

if (openDiffBtn && diffModal) {
    openDiffBtn.addEventListener('click', () => {
        syncNameInputState();
        diffModal.classList.add('active');
        openDiffBtn.blur();
    });
}

applyDifficulty(gameDifficulty);
if (diffModal && (!playerName || playerName.trim() === '')) {
    syncNameInputState();
    diffModal.classList.add('active');
    if (playerNameInput) {
        setTimeout(() => {
            playerNameInput.focus();
        }, 100);
    }
}

// Colores
const colorSnakeBody = '#769656';
const colorFood = '#e24e4e';

// Audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playEatSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    const baseFreq = 400 + (score * 3);
    osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playCrashSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playVictorySound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [400, 500, 600, 800]; 
    let startTime = audioCtx.currentTime;
    notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, startTime + (index * 0.15));
        gain.gain.linearRampToValueAtTime(0.1, startTime + (index * 0.15) + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + (index * 0.15) + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime + (index * 0.15));
        osc.stop(startTime + (index * 0.15) + 0.2);
    });
}

function resetGame() {
    if (promptTimeout) clearTimeout(promptTimeout);
    const banner = document.getElementById('congrats-banner');
    if (banner) banner.classList.remove('show');
    
    snake = [{ x: 10, y: 10 }];
    dx = 0;
    dy = 0;
    nextDx = 0;
    nextDy = 0;
    score = 0;
    scoreElement.textContent = score;
    placeFood();
    gameActive = true;
    startBtn.textContent = "Reiniciar Juego";
    startBtn.blur();
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, currentIntervalMs);
    draw();
}

function gameLoop() {
    if (!gameActive) return;

    dx = nextDx;
    dy = nextDy;

    if (dx === 0 && dy === 0) {
        draw();
        return;
    }

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
        return;
    }

    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        showFloatingPoints(pointsPerFood);
        score += pointsPerFood;
        scoreElement.textContent = score;
        playEatSound();
        placeFood();
    } else {
        snake.pop();
    }

    draw();
}

function gameOver() {
    gameActive = false;
    clearInterval(gameInterval);
    playCrashSound();
    
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#eeeed2';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('¡Fin del Juego, manco!', canvas.width / 2, canvas.height / 2 - 10);
    
    ctx.font = '24px Arial';
    ctx.fillText(`Puntaje Final: ${score}`, canvas.width / 2, canvas.height / 2 + 30);
    
    saveScore(score);
}

function draw() {
    for (let r = 0; r < tileCount; r++) {
        for (let c = 0; c < tileCount; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#262320' : '#2f2b27';
            ctx.fillRect(c * gridSize, r * gridSize, gridSize, gridSize);
        }
    }

    // Comida
    ctx.fillStyle = colorFood;
    ctx.beginPath();
    ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, gridSize / 2 - 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Brillo comida
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(food.x * gridSize + gridSize / 2 - 3, food.y * gridSize + gridSize / 2 - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo
    for (let i = snake.length - 1; i > 0; i--) {
        const seg = snake[i];
        const segX = seg.x * gridSize;
        const segY = seg.y * gridSize;

        ctx.fillStyle = colorSnakeBody;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(segX + 1.5, segY + 1.5, gridSize - 3, gridSize - 3, 6);
            ctx.fill();
        } else {
            ctx.fillRect(segX + 1.5, segY + 1.5, gridSize - 3, gridSize - 3);
        }

        ctx.fillStyle = 'rgba(238, 238, 210, 0.2)';
        ctx.fillRect(segX + 5, segY + 5, gridSize - 10, gridSize - 10);
    }

    // Cabeza
    if (snake.length > 0) {
        const head = snake[0];
        const cx = head.x * gridSize + gridSize / 2;
        const cy = head.y * gridSize + gridSize / 2;

        let angle = 0;
        if (dx === -1) angle = Math.PI;
        else if (dy === -1) angle = -Math.PI / 2;
        else if (dy === 1) angle = Math.PI / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Lengua
        ctx.fillStyle = '#e24e4e';
        ctx.beginPath();
        ctx.moveTo(gridSize / 2 - 2, 0);
        ctx.lineTo(gridSize / 2 + 7, -3.5);
        ctx.lineTo(gridSize / 2 + 4, 0);
        ctx.lineTo(gridSize / 2 + 7, 3.5);
        ctx.closePath();
        ctx.fill();

        // Cabeza
        ctx.fillStyle = '#83a85c';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-gridSize / 2 + 1, -gridSize / 2 + 1, gridSize - 2, gridSize - 2, [5, 10, 10, 5]);
        } else {
            ctx.arc(0, 0, gridSize / 2 - 1, 0, Math.PI * 2);
        }
        ctx.fill();

        // Ojos
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(3, -5.5, 3.4, 0, Math.PI * 2);
        ctx.arc(3, 5.5, 3.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(4.2, -5.5, 1.8, 0, Math.PI * 2);
        ctx.arc(4.2, 5.5, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

function placeFood() {
    let newFood;
    let isOccupied;
    do {
        isOccupied = false;
        newFood = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === newFood.x && snake[i].y === newFood.y) {
                isOccupied = true;
                break;
            }
        }
    } while (isOccupied);
    food = newFood;
}

document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
    if (!gameActive && (e.code === 'Space' || e.key === 'Enter')) {
        resetGame();
        return;
    }
    if (!gameActive) return;

    if (e.code === 'ArrowUp' && dy !== 1) { nextDx = 0; nextDy = -1; }
    if (e.code === 'ArrowDown' && dy !== -1) { nextDx = 0; nextDy = 1; }
    if (e.code === 'ArrowLeft' && dx !== 1) { nextDx = -1; nextDy = 0; }
    if (e.code === 'ArrowRight' && dx !== -1) { nextDx = 1; nextDy = 0; }
});

startBtn.addEventListener('click', resetGame);

// ---------- SISTEMA DE RANKING (DREAMLO ONLINE) ----------
// Configuración activa de Dreamlo Cloud Leaderboard
const DREAMLO_PUBLIC_KEY = '6a8201a18f40bb135064ca7b'; // Tu Public Code activo
const DREAMLO_PRIVATE_KEY = 'WaMpx_5RtESJFHYr6CExwQ7s_2bFE6CEKe2v7N1uMpnw'; // Tu Private Code activo

let onlineRanking = [];

// Helper para obtener la URL de Dreamlo sobre HTTPS con soporte CORS nativo
function getDreamloUrl(path) {
    return `https://dreamlo.com/lb/${path}`;
}

async function loadRanking(isBackground = false) {
    if (!isBackground) {
        // stale-while-revalidate: Cargar caché local primero para respuesta instantánea
        const cached = localStorage.getItem('snake_online_ranking_cache');
        if (cached) {
            try {
                onlineRanking = JSON.parse(cached);
                renderRanking(onlineRanking);
            } catch (e) {
                console.warn('Error parsing cached ranking:', e);
            }
        }
        
        // Si no hay caché cargada, mostrar el spinner/cargando
        if (!onlineRanking || onlineRanking.length === 0) {
            rankingBody.innerHTML = '<tr><td colspan="3" style="text-align:center; opacity:0.6; color: rgba(238,238,210,0.6);">Cargando Top 10...</td></tr>';
        }
    }

    if (!DREAMLO_PUBLIC_KEY || DREAMLO_PUBLIC_KEY.trim() === '') {
        renderLocalRanking();
        return;
    }

    // Timeout de 2.5s con AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
        const res = await fetch(getDreamloUrl(`${DREAMLO_PUBLIC_KEY}/json/10`), {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        let entries = [];
        if (data && data.dreamlo && data.dreamlo.leaderboard && data.dreamlo.leaderboard.entry) {
            const raw = data.dreamlo.leaderboard.entry;
            entries = Array.isArray(raw) ? raw : [raw];
        }
        onlineRanking = entries.map(e => ({
            name: (e.name || 'Jugador').split('__')[0],
            score: parseInt(e.score, 10) || 0
        }));
        onlineRanking.sort((a, b) => b.score - a.score);

        // Guardar en la caché local
        localStorage.setItem('snake_online_ranking_cache', JSON.stringify(onlineRanking));

        renderRanking(onlineRanking);
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.warn('La petición a Dreamlo excedió el timeout de 2.5s. Usando datos cacheados.');
        } else {
            console.warn('No se pudo conectar con Dreamlo, usando ranking local/caché:', err);
        }

        // Si falló la red y no tenemos nada en caché/memoria, mostramos el ranking local
        if (!onlineRanking || onlineRanking.length === 0) {
            renderLocalRanking();
        }
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function renderRanking(list) {
    rankingBody.innerHTML = '';
    if (!list || list.length === 0) {
        rankingBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: rgba(238,238,210,0.6);">No hay puntajes aún</td></tr>';
        return;
    }
    list.slice(0, 10).forEach((entry, index) => {
        const tr = document.createElement('tr');
        const medal = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';
        tr.innerHTML = `
            <td>${medal}${index + 1}</td>
            <td>${escapeHTML(entry.name)}</td>
            <td><strong>${entry.score}</strong></td>
        `;
        rankingBody.appendChild(tr);
    });
}

function renderLocalRanking() {
    let ranking = JSON.parse(localStorage.getItem('snakeRanking')) || [];
    ranking.sort((a, b) => b.score - a.score);
    renderRanking(ranking);
}

async function saveScore(finalScore) {
    if (finalScore === 0) return; // Ignorar puntajes de 0

    // Obtener la lista actual antes de guardar el nuevo record para calcular la posición real
    const activeRanking = (DREAMLO_PRIVATE_KEY && DREAMLO_PRIVATE_KEY !== 'TU_CLAVE_PRIVADA_AQUI') 
        ? onlineRanking 
        : (JSON.parse(localStorage.getItem('snakeRanking')) || []);

    const top1 = activeRanking[0]?.score || 0;
    const top2 = activeRanking[1]?.score || 0;
    const top3 = activeRanking[2]?.score || 0;

    let myRank = 0;
    if (finalScore >= top1) {
        myRank = 1;
    } else if (finalScore >= top2) {
        myRank = 2;
    } else if (finalScore >= top3) {
        myRank = 3;
    }

    // 1. Guardar en Dreamlo Online con Actualización Optimista
    if (DREAMLO_PRIVATE_KEY && DREAMLO_PRIVATE_KEY !== 'TU_CLAVE_PRIVADA_AQUI') {
        const cleanName = (playerName || 'Jugador').replace(/[^a-zA-Z0-9]/g, '');
        
        // Entrada optimista
        const optimisticEntry = { name: cleanName, score: finalScore };
        
        // Agregar, ordenar y limitar a Top 10 en memoria
        onlineRanking.push(optimisticEntry);
        onlineRanking.sort((a, b) => b.score - a.score);
        onlineRanking = onlineRanking.slice(0, 10);
        
        // Guardar al instante en caché y renderizar en la UI
        localStorage.setItem('snake_online_ranking_cache', JSON.stringify(onlineRanking));
        renderRanking(onlineRanking);

        // Realizar la petición de red de fondo
        const uniqueEntryName = `${cleanName}__${Date.now().toString(36)}`;
        fetch(getDreamloUrl(`${DREAMLO_PRIVATE_KEY}/add/${uniqueEntryName}/${finalScore}`))
            .then(() => loadRanking(true)) // Refrescar en background
            .catch(e => console.error('Error guardando en Dreamlo:', e));
    } else {
        // Fallback local
        let localRank = JSON.parse(localStorage.getItem('snakeRanking')) || [];
        localRank.push({ name: playerName || 'Jugador', score: finalScore });
        localRank.sort((a, b) => b.score - a.score);
        localStorage.setItem('snakeRanking', JSON.stringify(localRank));
        loadRanking();
    }

    // 2. Si entra en el Top 3, lanzar celebración correspondiente
    if (myRank >= 1 && myRank <= 3) {
        promptTimeout = setTimeout(() => {
            fireConfetti();
            playVictorySound();
            const banner = document.getElementById('congrats-banner');
            if (banner) {
                // Resetear clases de medalla previas
                banner.classList.remove('gold', 'silver', 'bronze');
                
                if (myRank === 1) {
                    banner.classList.add('gold');
                    banner.innerHTML = `
                        <img src="gordi.jpg" alt="La Gordi" class="gordi-img"><br>
                        ¡NUEVO RÉCORD #1!<br>
                        <span style="font-size: 1.5rem">¡Felicidades! 🎉</span>
                    `;
                } else if (myRank === 2) {
                    banner.classList.add('silver');
                    banner.innerHTML = `
                        <img src="gordi.jpg" alt="La Gordi" class="gordi-img"><br>
                        ¡NUEVO RÉCORD #2!<br>
                        <span style="font-size: 1.5rem">¡Felicidades! 🎉</span>
                    `;
                } else if (myRank === 3) {
                    banner.classList.add('bronze');
                    banner.innerHTML = `
                        <img src="gordi.jpg" alt="La Gordi" class="gordi-img"><br>
                        ¡NUEVO RÉCORD #3!<br>
                        <span style="font-size: 1.5rem">¡Felicidades! 🎉</span>
                    `;
                }

                banner.classList.add('show');
                promptTimeout = setTimeout(() => {
                    banner.classList.remove('show');
                }, 3500);
            }
        }, 100);
    }
}

// ---------- CONFETI ----------
const confettiCanvas = document.getElementById('confetti-canvas');
const confCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiAnimationId = null;

function fireConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiParticles = [];
    const colors = ['#f6e165', '#e24e4e', '#769656', '#eeeed2', '#5bc0eb'];
    
    for (let i = 0; i < 150; i++) {
        confettiParticles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            r: Math.random() * 6 + 4,
            dx: Math.random() * 4 - 2,
            dy: Math.random() * 5 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.floor(Math.random() * 10) - 10,
            tiltAngle: 0,
            tiltAngleInc: (Math.random() * 0.07) + 0.05
        });
    }
    if (!confettiAnimationId) animateConfetti();
}

function animateConfetti() {
    confettiAnimationId = requestAnimationFrame(animateConfetti);
    confCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let active = false;
    for (let i = 0; i < confettiParticles.length; i++) {
        let p = confettiParticles[i];
        p.tiltAngle += p.tiltAngleInc;
        p.y += p.dy;
        p.x += Math.sin(p.tiltAngle) * 2;
        if (p.y <= confettiCanvas.height) active = true;
        confCtx.beginPath();
        confCtx.lineWidth = p.r;
        confCtx.strokeStyle = p.color;
        confCtx.moveTo(p.x + p.tilt + p.r, p.y);
        confCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
        confCtx.stroke();
    }
    if (!active) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }
}

window.addEventListener('resize', () => {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
});

loadRanking();
draw();
