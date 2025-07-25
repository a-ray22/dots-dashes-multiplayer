// Game state
let socket;
let playerId;
let playerName;
let gameState = null;
let selectedDot = null;
let gameSize = 6;
let dotSpacing = 60;

// DOM elements
const loadingScreen = document.getElementById('loadingScreen');
const welcomeScreen = document.getElementById('welcomeScreen');
const gameScreen = document.getElementById('gameScreen');
const playerNameInput = document.getElementById('playerName');
const joinGameBtn = document.getElementById('joinGameBtn');
const gameUrl = document.getElementById('gameUrl');
const dotsGrid = document.getElementById('dotsGrid');
const waitingMessage = document.getElementById('waitingMessage');
const gameOverMessage = document.getElementById('gameOverMessage');
const winnerMessage = document.getElementById('winnerMessage');
const disconnectedModal = document.getElementById('disconnectedModal');
const closeDisconnectedModal = document.getElementById('closeDisconnectedModal');
const newGameBtn = document.getElementById('newGameBtn');

// Player elements
const player1Name = document.getElementById('player1Name');
const player2Name = document.getElementById('player2Name');
const score1 = document.getElementById('score1');
const score2 = document.getElementById('score2');
const currentPlayerName = document.getElementById('currentPlayerName');
const playerCount = document.getElementById('playerCount');
const currentPlayerIndicator = document.getElementById('currentPlayerIndicator');

// Panel elements
const player1NamePanel = document.getElementById('player1NamePanel');
const player2NamePanel = document.getElementById('player2NamePanel');
const score1Panel = document.getElementById('score1Panel');
const score2Panel = document.getElementById('score2Panel');
const player1Initial = document.getElementById('player1Initial');
const player2Initial = document.getElementById('player2Initial');
const player1Status = document.getElementById('player1Status');
const player2Status = document.getElementById('player2Status');
const player1Info = document.getElementById('player1Info');
const player2Info = document.getElementById('player2Info');
const player1Score = document.getElementById('player1Score');
const player2Score = document.getElementById('player2Score');

// Game history
const gameHistory = document.getElementById('gameHistory');

// Initialize the game
function init() {
    // Set game URL
    gameUrl.textContent = window.location.href;
    
    // Add event listeners
    joinGameBtn.addEventListener('click', joinGame);
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
    
    closeDisconnectedModal.addEventListener('click', () => {
        disconnectedModal.classList.add('hidden');
    });
    
    newGameBtn.addEventListener('click', () => {
        if (socket) {
            socket.emit('joinGame', playerName);
        }
    });
    
    // Connect to server
    connectToServer();
}

// Connect to the server
function connectToServer() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        hideLoadingScreen();
        showWelcomeScreen();
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showDisconnectedMessage();
    });
    
    socket.on('gameJoined', (data) => {
        console.log('Game joined:', data);
        playerId = data.playerId;
        playerName = data.playerName;
        gameState = data.gameState;
        
        hideWelcomeScreen();
        showGameScreen();
        renderGame();
        updatePlayerInfo();
        
        if (gameState.players.length === 1) {
            showWaitingMessage();
        }
    });
    
    socket.on('playerJoined', (data) => {
        console.log('Player joined:', data);
        gameState = data.gameState;
        hideWaitingMessage();
        updatePlayerInfo();
        renderGame();
    });
    
    socket.on('moveMade', (data) => {
        console.log('Move made:', data);
        gameState = data.gameState;
        renderMove(data.move, data.completedBoxes, data.scoreGained);
        updateScores();
        updateCurrentPlayer();
        
        if (data.gameOver) {
            setTimeout(() => {
                showGameOverMessage();
            }, 1000);
        }
    });
    
    socket.on('gameOver', (data) => {
        console.log('Game over:', data);
        showGameOverMessage(data.winner, data.scores);
    });
    
    socket.on('playerDisconnected', (data) => {
        console.log('Player disconnected:', data);
        showDisconnectedModal();
    });
    
    socket.on('gameEnded', (data) => {
        console.log('Game ended:', data);
        showGameEndedMessage(data.reason);
    });
    
    socket.on('gameFull', () => {
        alert('Game is full. Please try again later.');
    });
    
    socket.on('moveError', (message) => {
        alert('Move error: ' + message);
    });
    
    socket.on('noActiveGame', () => {
        console.log('No active game');
        showWelcomeScreen();
    });
}

// Join game
function joinGame() {
    const name = playerNameInput.value.trim();
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    if (name.length > 20) {
        alert('Name must be 20 characters or less');
        return;
    }
    
    playerName = name;
    socket.emit('joinGame', name);
}

// Show/hide screens
function hideLoadingScreen() {
    loadingScreen.classList.add('hidden');
}

function showWelcomeScreen() {
    welcomeScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
}

function hideWelcomeScreen() {
    welcomeScreen.classList.add('hidden');
}

function showGameScreen() {
    gameScreen.classList.remove('hidden');
}

function showWaitingMessage() {
    waitingMessage.classList.remove('hidden');
    gameOverMessage.classList.add('hidden');
}

function hideWaitingMessage() {
    waitingMessage.classList.add('hidden');
}

function showGameOverMessage(winner, scores) {
    gameOverMessage.classList.remove('hidden');
    waitingMessage.classList.add('hidden');
    
    if (winner && scores) {
        const winnerText = winner === playerName ? 'You won!' : `${winner} won!`;
        const scoreText = `Final score: ${scores[0]} - ${scores[1]}`;
        winnerMessage.textContent = `${winnerText} ${scoreText}`;
    }
}

function showGameEndedMessage(reason) {
    gameOverMessage.classList.remove('hidden');
    waitingMessage.classList.add('hidden');
    winnerMessage.textContent = `Game ended: ${reason}`;
}

function showDisconnectedModal() {
    disconnectedModal.classList.remove('hidden');
}

function showDisconnectedMessage() {
    alert('Connection lost. Please refresh the page to reconnect.');
}

// Render the game grid
function renderGame() {
    if (!gameState) return;
    
    dotsGrid.innerHTML = '';
    dotsGrid.style.width = `${(gameSize + 1) * dotSpacing}px`;
    dotsGrid.style.height = `${(gameSize + 1) * dotSpacing}px`;
    
    // Create dots
    for (let row = 0; row <= gameSize; row++) {
        for (let col = 0; col <= gameSize; col++) {
            createDot(row, col);
        }
    }
    
    // Create lines
    renderLines();
    
    // Create boxes
    renderBoxes();
}

// Create a dot
function createDot(row, col) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.left = `${col * dotSpacing}px`;
    dot.style.top = `${row * dotSpacing}px`;
    dot.dataset.row = row;
    dot.dataset.col = col;
    
    dot.addEventListener('click', () => handleDotClick(row, col));
    dot.addEventListener('mouseenter', () => handleDotHover(row, col));
    dot.addEventListener('mouseleave', () => handleDotLeave());
    
    dotsGrid.appendChild(dot);
}

// Handle dot click
function handleDotClick(row, col) {
    if (!gameState || gameState.gameOver) return;
    
    if (selectedDot) {
        const [selectedRow, selectedCol] = selectedDot;
        
        // Determine line type and position
        let lineType, lineRow, lineCol;
        
        if (row === selectedRow) {
            // Horizontal line
            lineType = 'h';
            lineRow = row;
            lineCol = Math.min(col, selectedCol);
        } else if (col === selectedCol) {
            // Vertical line
            lineType = 'v';
            lineRow = Math.min(row, selectedRow);
            lineCol = col;
        } else {
            // Invalid move - dots not adjacent
            clearSelectedDot();
            return;
        }
        
        // Make move
        socket.emit('makeMove', {
            lineType: lineType,
            row: lineRow,
            col: lineCol
        });
        
        clearSelectedDot();
    } else {
        selectDot(row, col);
    }
}

// Handle dot hover
function handleDotHover(row, col) {
    if (selectedDot) {
        const [selectedRow, selectedCol] = selectedDot;
        
        if (row === selectedRow || col === selectedCol) {
            // Show preview line
            showPreviewLine(selectedRow, selectedCol, row, col);
        }
    }
}

// Handle dot leave
function handleDotLeave() {
    hidePreviewLine();
}

// Select a dot
function selectDot(row, col) {
    clearSelectedDot();
    selectedDot = [row, col];
    
    const dot = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (dot) {
        dot.classList.add('active');
    }
}

// Clear selected dot
function clearSelectedDot() {
    if (selectedDot) {
        const [row, col] = selectedDot;
        const dot = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (dot) {
            dot.classList.remove('active');
        }
        selectedDot = null;
    }
    hidePreviewLine();
}

// Show preview line
function showPreviewLine(row1, col1, row2, col2) {
    hidePreviewLine();
    
    const previewLine = document.createElement('div');
    previewLine.className = 'line preview';
    previewLine.id = 'previewLine';
    
    if (row1 === row2) {
        // Horizontal line
        previewLine.classList.add('horizontal');
        const left = Math.min(col1, col2) * dotSpacing + 6;
        const width = dotSpacing - 12;
        previewLine.style.left = `${left}px`;
        previewLine.style.top = `${row1 * dotSpacing + 4}px`;
        previewLine.style.width = `${width}px`;
    } else {
        // Vertical line
        previewLine.classList.add('vertical');
        const top = Math.min(row1, row2) * dotSpacing + 6;
        const height = dotSpacing - 12;
        previewLine.style.left = `${col1 * dotSpacing + 4}px`;
        previewLine.style.top = `${top}px`;
        previewLine.style.height = `${height}px`;
    }
    
    dotsGrid.appendChild(previewLine);
}

// Hide preview line
function hidePreviewLine() {
    const previewLine = document.getElementById('previewLine');
    if (previewLine) {
        previewLine.remove();
    }
}

// Render lines
function renderLines() {
    if (!gameState) return;
    
    // Render horizontal lines
    Object.entries(gameState.grid.horizontal).forEach(([key, playerId]) => {
        if (playerId !== null) {
            const [row, col] = key.split('-').map(Number);
            createLine('h', row, col, playerId);
        }
    });
    
    // Render vertical lines
    Object.entries(gameState.grid.vertical).forEach(([key, playerId]) => {
        if (playerId !== null) {
            const [row, col] = key.split('-').map(Number);
            createLine('v', row, col, playerId);
        }
    });
}

// Create a line
function createLine(type, row, col, playerId) {
    const line = document.createElement('div');
    line.className = `line ${type === 'h' ? 'horizontal' : 'vertical'}`;
    line.id = `line-${type}-${row}-${col}`;
    
    const playerIndex = gameState.players.indexOf(playerId);
    if (playerIndex === 0) {
        line.classList.add('player1');
    } else if (playerIndex === 1) {
        line.classList.add('player2');
    }
    
    if (type === 'h') {
        line.style.left = `${col * dotSpacing + 6}px`;
        line.style.top = `${row * dotSpacing + 4}px`;
        line.style.width = `${dotSpacing - 12}px`;
    } else {
        line.style.left = `${col * dotSpacing + 4}px`;
        line.style.top = `${row * dotSpacing + 6}px`;
        line.style.height = `${dotSpacing - 12}px`;
    }
    
    dotsGrid.appendChild(line);
}

// Render boxes
function renderBoxes() {
    if (!gameState) return;
    
    Object.entries(gameState.grid.boxes).forEach(([key, playerId]) => {
        if (playerId !== null) {
            const [row, col] = key.split('-').map(Number);
            createBox(row, col, playerId);
        }
    });
}

// Create a box
function createBox(row, col, playerId) {
    const box = document.createElement('div');
    box.className = 'box';
    box.id = `box-${row}-${col}`;
    
    const playerIndex = gameState.players.indexOf(playerId);
    if (playerIndex === 0) {
        box.classList.add('player1');
    } else if (playerIndex === 1) {
        box.classList.add('player2');
    }
    
    box.style.left = `${col * dotSpacing + 6}px`;
    box.style.top = `${row * dotSpacing + 6}px`;
    box.style.width = `${dotSpacing - 12}px`;
    box.style.height = `${dotSpacing - 12}px`;
    
    // Add score indicator
    const scoreIndicator = document.createElement('div');
    scoreIndicator.className = 'score-indicator';
    scoreIndicator.textContent = playerIndex === 0 ? '1' : '2';
    box.appendChild(scoreIndicator);
    
    dotsGrid.appendChild(box);
}

// Render a move
function renderMove(move, completedBoxes, scoreGained) {
    // Create the line
    createLine(move.lineType, move.row, move.col, move.player);
    
    // Add completion animation
    const line = document.getElementById(`line-${move.lineType}-${move.row}-${move.col}`);
    if (line) {
        line.classList.add('completed');
    }
    
    // Create completed boxes
    if (completedBoxes && completedBoxes.length > 0) {
        completedBoxes.forEach(boxKey => {
            const [row, col] = boxKey.split('-').map(Number);
            createBox(row, col, move.player);
            
            const box = document.getElementById(`box-${row}-${col}`);
            if (box) {
                box.classList.add('completed');
            }
        });
    }
    
    // Show score gained animation
    if (scoreGained > 0) {
        showScoreAnimation(scoreGained);
    }
}

// Show score animation
function showScoreAnimation(score) {
    const animation = document.createElement('div');
    animation.className = 'fixed inset-0 flex items-center justify-center z-50 pointer-events-none';
    animation.innerHTML = `
        <div class="text-6xl font-bold text-green-500 animate-bounce-gentle">
            +${score}
        </div>
    `;
    
    document.body.appendChild(animation);
    
    setTimeout(() => {
        animation.remove();
    }, 2000);
}

// Update player information
function updatePlayerInfo() {
    if (!gameState) return;
    
    const players = gameState.players;
    const scores = gameState.scores;
    
    // Update player names
    if (players.length > 0) {
        const name1 = getPlayerName(players[0]);
        player1Name.textContent = name1;
        player1NamePanel.textContent = name1;
        player1Initial.textContent = name1.charAt(0).toUpperCase();
        player1Info.classList.remove('opacity-50');
        player1Status.classList.remove('bg-gray-400');
        player1Status.classList.add('bg-green-500');
    }
    
    if (players.length > 1) {
        const name2 = getPlayerName(players[1]);
        player2Name.textContent = name2;
        player2NamePanel.textContent = name2;
        player2Initial.textContent = name2.charAt(0).toUpperCase();
        player2Info.classList.remove('opacity-50');
        player2Status.classList.remove('bg-gray-400');
        player2Status.classList.add('bg-green-500');
    }
    
    // Update scores
    score1.textContent = scores[0] || 0;
    score2.textContent = scores[1] || 0;
    score1Panel.textContent = scores[0] || 0;
    score2Panel.textContent = scores[1] || 0;
    
    // Update player count
    playerCount.textContent = `${players.length}/2`;
    
    // Update current player
    updateCurrentPlayer();
}

// Update current player indicator
function updateCurrentPlayer() {
    if (!gameState) return;
    
    const currentPlayerId = gameState.players[gameState.currentPlayer];
    const currentPlayerName = getPlayerName(currentPlayerId);
    
    if (currentPlayerId === playerId) {
        document.getElementById('currentPlayerName').textContent = 'Your turn';
        currentPlayerIndicator.classList.remove('bg-red-100', 'dark:bg-red-900/30');
        currentPlayerIndicator.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
    } else {
        document.getElementById('currentPlayerName').textContent = `${currentPlayerName}'s turn`;
        currentPlayerIndicator.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
        currentPlayerIndicator.classList.add('bg-red-100', 'dark:bg-red-900/30');
    }
}

// Update scores
function updateScores() {
    if (!gameState) return;
    
    const scores = gameState.scores;
    score1.textContent = scores[0];
    score2.textContent = scores[1];
    score1Panel.textContent = scores[0];
    score2Panel.textContent = scores[1];
}

// Get player name by ID
function getPlayerName(playerId) {
    // This would normally come from the server
    // For now, we'll use the stored player name or a default
    if (playerId === playerId) {
        return playerName;
    }
    return 'Player ' + (gameState.players.indexOf(playerId) + 1);
}

// Update game history
function updateGameHistory(history) {
    if (!history || history.length === 0) {
        gameHistory.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
                No recent games
            </div>
        `;
        return;
    }
    
    const recentGames = history.slice(-5); // Show last 5 games
    gameHistory.innerHTML = recentGames.map(game => `
        <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div class="flex justify-between items-center text-sm">
                <div>
                    <div class="font-medium text-gray-800 dark:text-white">
                        ${game.players.join(' vs ')}
                    </div>
                    <div class="text-gray-600 dark:text-gray-400">
                        ${game.scores[0]} - ${game.scores[1]}
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-medium ${game.winner === 'Disconnected' ? 'text-red-500' : 'text-green-500'}">
                        ${game.winner === 'Disconnected' ? 'Disconnected' : game.winner}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        ${new Date(game.completedAt).toLocaleDateString()}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', init);

// Handle window resize
window.addEventListener('resize', () => {
    if (gameState) {
        renderGame();
    }
});

// Handle page visibility change (for reconnection)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && socket && !socket.connected) {
        console.log('Page became visible, attempting to reconnect...');
        socket.connect();
    }
}); 