// Game state
let gameState = null;
let playerId = null;
let playerName = null;
let lastUpdate = 0;
let pollInterval = null;

// Initialize the game
function init() {
    showScreen('loading');
    
    // Generate unique player ID
    playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Check if we're in production (Vercel) or development
    const isProduction = window.location.hostname !== 'localhost';
    
    if (isProduction) {
        // Use API polling for Vercel
        initAPIGame();
    } else {
        // Use Socket.IO for local development
        initSocketGame();
    }
}

// API-based game (for Vercel)
function initAPIGame() {
    console.log('Initializing API-based game for Vercel');
    
    // Test API connection first
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            console.log('API health check:', data);
            showScreen('welcome');
        })
        .catch(error => {
            console.error('API health check failed:', error);
            // Still show welcome screen even if API fails
            showScreen('welcome');
        });
}

// Socket.IO-based game (for local development)
function initSocketGame() {
    console.log('Initializing Socket.IO-based game for local development');
    
    // Load Socket.IO from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
    script.onload = () => {
        connectToServer();
    };
    document.head.appendChild(script);
}

// API game functions
function joinGameAPI() {
    if (!playerName) {
        showScreen('welcome');
        return;
    }
    
    fetch('/api/join', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            playerName: playerName,
            playerId: playerId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            gameState = data.gameState;
            showScreen('game');
            renderGame();
            startPolling();
        } else {
            alert('Error joining game: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error joining game:', error);
        alert('Error joining game. Please try again.');
    });
}

function makeMoveAPI(lineType, row, col) {
    fetch('/api/move', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            playerId: playerId,
            lineType: lineType,
            row: row,
            col: col
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            gameState = data.gameState;
            renderGame();
            
            if (data.completedBoxes && data.completedBoxes.length > 0) {
                showScoreAnimation(data.scoreGained);
            }
            
            if (data.gameOver) {
                setTimeout(() => {
                    const winner = gameState.scores[0] > gameState.scores[1] ? 
                        gameState.players[0] : gameState.players[1];
                    alert(`Game Over! ${winner} wins!`);
                    stopPolling();
                }, 1000);
            }
        } else {
            alert('Invalid move: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error making move:', error);
        alert('Error making move. Please try again.');
    });
}

function startPolling() {
    pollInterval = setInterval(() => {
        fetch(`/api/poll/${lastUpdate}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.hasUpdate) {
                    gameState = data.gameState;
                    lastUpdate = data.lastUpdate;
                    renderGame();
                }
            })
            .catch(error => {
                console.error('Polling error:', error);
            });
    }, 1000); // Poll every second
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// Socket.IO game functions (for local development)
function connectToServer() {
    const socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        showScreen('welcome');
    });
    
    socket.on('gameJoined', (data) => {
        gameState = data.gameState;
        playerId = data.playerId;
        playerName = data.playerName;
        showScreen('game');
        renderGame();
    });
    
    socket.on('playerJoined', (data) => {
        gameState = data.gameState;
        renderGame();
        updatePlayerInfo();
    });
    
    socket.on('moveMade', (data) => {
        gameState = data.gameState;
        renderGame();
        
        if (data.completedBoxes && data.completedBoxes.length > 0) {
            showScoreAnimation(data.scoreGained);
        }
        
        if (data.gameOver) {
            setTimeout(() => {
                const winner = gameState.scores[0] > gameState.scores[1] ? 
                    gameState.players[0] : gameState.players[1];
                alert(`Game Over! ${winner} wins!`);
            }, 1000);
        }
    });
    
    socket.on('gameFull', () => {
        alert('Game is full. Please wait for a spot to open up.');
    });
    
    socket.on('moveError', (message) => {
        alert('Invalid move: ' + message);
    });
    
    socket.on('playerDisconnected', (data) => {
        alert(`${data.playerName} disconnected. Waiting for reconnection...`);
    });
    
    socket.on('gameEnded', (data) => {
        alert('Game ended: ' + data.reason);
        showScreen('welcome');
    });
    
    window.socket = socket;
}

function joinGame() {
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    
    if (window.socket) {
        window.socket.emit('joinGame', playerName);
    } else {
        joinGameAPI();
    }
}

function makeMove(lineType, row, col) {
    if (window.socket) {
        window.socket.emit('makeMove', { lineType, row, col });
    } else {
        makeMoveAPI(lineType, row, col);
    }
}

// UI Functions
function showScreen(screenName) {
    console.log('Showing screen:', screenName);
    // Hide all screens
    document.querySelectorAll('#loadingScreen, #welcomeScreen, #gameScreen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    // Show the requested screen
    const screen = document.getElementById(screenName + 'Screen');
    console.log('Screen element found:', screen);
    if (screen) {
        screen.style.display = 'flex';
    } else {
        console.error('Screen not found:', screenName + 'Screen');
    }
}

function updatePlayerInfo() {
    const playerInfo = document.getElementById('playerInfo');
    if (playerInfo && gameState) {
        const players = gameState.players.map(id => getPlayerName(id));
        playerInfo.innerHTML = `
            <div class="player">
                <span class="player-name">${players[0] || 'Waiting...'}</span>
                <span class="player-score">${gameState.scores[0]}</span>
            </div>
            <div class="vs">VS</div>
            <div class="player">
                <span class="player-name">${players[1] || 'Waiting...'}</span>
                <span class="player-score">${gameState.scores[1]}</span>
            </div>
        `;
    }
}

function updateCurrentPlayer() {
    const currentPlayerEl = document.getElementById('currentPlayer');
    if (currentPlayerEl && gameState) {
        const currentPlayerName = getPlayerName(gameState.players[gameState.currentPlayer]);
        currentPlayerEl.textContent = `Current Turn: ${currentPlayerName}`;
    }
}

function updateScores() {
    const scoresEl = document.getElementById('scores');
    if (scoresEl && gameState) {
        scoresEl.innerHTML = `
            <div class="score">
                <span class="player-name">${getPlayerName(gameState.players[0])}</span>
                <span class="score-value">${gameState.scores[0]}</span>
            </div>
            <div class="score">
                <span class="player-name">${getPlayerName(gameState.players[1])}</span>
                <span class="score-value">${gameState.scores[1]}</span>
            </div>
        `;
    }
}

function getPlayerName(playerId) {
    if (!playerId) return 'Unknown';
    return playerId === playerId ? playerName : `Player ${gameState.players.indexOf(playerId) + 1}`;
}

function renderGame() {
    if (!gameState) return;
    
    renderDots();
    renderLines();
    renderBoxes();
    updatePlayerInfo();
    updateCurrentPlayer();
    updateScores();
}

function renderDots() {
    const gameBoard = document.getElementById('gameBoard');
    if (!gameBoard) return;
    
    // Clear existing dots
    const existingDots = gameBoard.querySelectorAll('.dot');
    existingDots.forEach(dot => dot.remove());
    
    // Create dots
    const size = 6; // 6x6 grid
    for (let row = 0; row <= size; row++) {
        for (let col = 0; col <= size; col++) {
            const dot = createDot(row, col);
            gameBoard.appendChild(dot);
        }
    }
}

function createDot(row, col) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.left = `${col * 60 + 20}px`;
    dot.style.top = `${row * 60 + 20}px`;
    dot.dataset.row = row;
    dot.dataset.col = col;
    
    dot.addEventListener('click', () => handleDotClick(row, col));
    
    return dot;
}

function handleDotClick(row, col) {
    // Find the closest line to this dot
    const lines = document.querySelectorAll('.line');
    let closestLine = null;
    let minDistance = Infinity;
    
    lines.forEach(line => {
        const lineRect = line.getBoundingClientRect();
        const dotRect = document.querySelector(`[data-row="${row}"][data-col="${col}"]`).getBoundingClientRect();
        
        const distance = Math.sqrt(
            Math.pow(lineRect.left - dotRect.left, 2) + 
            Math.pow(lineRect.top - dotRect.top, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestLine = line;
        }
    });
    
    if (closestLine && minDistance < 30) {
        const lineType = closestLine.dataset.type;
        const lineRow = parseInt(closestLine.dataset.row);
        const lineCol = parseInt(closestLine.dataset.col);
        
        makeMove(lineType, lineRow, lineCol);
    }
}

function selectDot(row, col) {
    // Remove previous selection
    document.querySelectorAll('.dot.selected').forEach(dot => {
        dot.classList.remove('selected');
    });
    
    // Select current dot
    const dot = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (dot) {
        dot.classList.add('selected');
    }
}

function renderLines() {
    const gameBoard = document.getElementById('gameBoard');
    if (!gameBoard || !gameState) return;
    
    // Clear existing lines
    const existingLines = gameBoard.querySelectorAll('.line');
    existingLines.forEach(line => line.remove());
    
    // Render horizontal lines
    Object.entries(gameState.grid.horizontal).forEach(([key, playerId]) => {
        if (playerId !== null) {
            const [row, col] = key.split('-').map(Number);
            const line = createLine('h', row, col, playerId);
            gameBoard.appendChild(line);
        }
    });
    
    // Render vertical lines
    Object.entries(gameState.grid.vertical).forEach(([key, playerId]) => {
        if (playerId !== null) {
            const [row, col] = key.split('-').map(Number);
            const line = createLine('v', row, col, playerId);
            gameBoard.appendChild(line);
        }
    });
}

function createLine(type, row, col, playerId) {
    const line = document.createElement('div');
    line.className = 'line';
    line.dataset.type = type;
    line.dataset.row = row;
    line.dataset.col = col;
    
    if (type === 'h') {
        line.style.left = `${col * 60 + 30}px`;
        line.style.top = `${row * 60 + 15}px`;
        line.style.width = '60px';
        line.style.height = '10px';
    } else {
        line.style.left = `${col * 60 + 15}px`;
        line.style.top = `${row * 60 + 30}px`;
        line.style.width = '10px';
        line.style.height = '60px';
    }
    
    // Color based on player
    const isCurrentPlayer = playerId === playerId;
    line.style.backgroundColor = isCurrentPlayer ? '#3b82f6' : '#ef4444';
    
    return line;
}

function renderBoxes() {
    const gameBoard = document.getElementById('gameBoard');
    if (!gameBoard || !gameState) return;
    
    // Clear existing boxes
    const existingBoxes = gameBoard.querySelectorAll('.box');
    existingBoxes.forEach(box => box.remove());
    
    // Render completed boxes
    Object.entries(gameState.grid.boxes).forEach(([key, playerId]) => {
        if (playerId !== null) {
            const [row, col] = key.split('-').map(Number);
            const box = createBox(row, col, playerId);
            gameBoard.appendChild(box);
        }
    });
}

function createBox(row, col, playerId) {
    const box = document.createElement('div');
    box.className = 'box';
    box.style.left = `${col * 60 + 30}px`;
    box.style.top = `${row * 60 + 30}px`;
    box.style.width = '60px';
    box.style.height = '60px';
    
    // Color based on player
    const isCurrentPlayer = playerId === playerId;
    box.style.backgroundColor = isCurrentPlayer ? '#3b82f6' : '#ef4444';
    box.style.opacity = '0.3';
    
    return box;
}

function renderMove(move) {
    if (!move) return;
    
    const gameBoard = document.getElementById('gameBoard');
    const line = createLine(move.type, move.row, move.col, move.player);
    gameBoard.appendChild(line);
}

function showScoreAnimation(score) {
    const animation = document.createElement('div');
    animation.className = 'score-animation';
    animation.textContent = `+${score}`;
    animation.style.position = 'absolute';
    animation.style.top = '50%';
    animation.style.left = '50%';
    animation.style.transform = 'translate(-50%, -50%)';
    animation.style.fontSize = '48px';
    animation.style.fontWeight = 'bold';
    animation.style.color = '#10b981';
    animation.style.zIndex = '1000';
    
    document.body.appendChild(animation);
    
    // Animate
    setTimeout(() => {
        animation.style.transform = 'translate(-50%, -50%) scale(1.5)';
        animation.style.opacity = '0';
    }, 100);
    
    setTimeout(() => {
        document.body.removeChild(animation);
    }, 1000);
}

function updateGameHistory() {
    fetch('/api/history')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const historyEl = document.getElementById('gameHistory');
                if (historyEl) {
                    historyEl.innerHTML = data.history.map(game => `
                        <div class="history-item">
                            <div class="history-players">${game.players.join(' vs ')}</div>
                            <div class="history-winner">Winner: ${game.winner}</div>
                            <div class="history-score">${game.scores.join(' - ')}</div>
                        </div>
                    `).join('');
                }
            }
        })
        .catch(error => {
            console.error('Error loading game history:', error);
        });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    
    // Set game URL
    const gameUrlElement = document.getElementById('gameUrl');
    if (gameUrlElement) {
        gameUrlElement.textContent = window.location.href;
    }
    
    init();
    
    // Welcome screen
    const joinButton = document.getElementById('joinGameBtn');
    console.log('Join button found:', joinButton);
    if (joinButton) {
        joinButton.addEventListener('click', () => {
            console.log('Join button clicked');
            const nameInput = document.getElementById('playerName');
            if (nameInput) {
                playerName = nameInput.value.trim();
                console.log('Player name:', playerName);
                if (playerName) {
                    joinGame();
                } else {
                    alert('Please enter your name');
                }
            }
        });
    }
    
    // Reset button
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            fetch('/api/reset', { method: 'POST' })
                .then(() => {
                    showScreen('welcome');
                    stopPolling();
                })
                .catch(error => {
                    console.error('Error resetting game:', error);
                });
        });
    }
}); 