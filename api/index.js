const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const GAME_STATE_FILE = process.env.NODE_ENV === 'production' 
  ? '/tmp/gameState.json' 
  : path.join(__dirname, '../gameState.json');

// Game state management
let gameState = {
  players: {},
  currentGame: null,
  gameHistory: [],
  lastUpdate: Date.now()
};

// Load existing game state if available
async function loadGameState() {
  try {
    if (await fs.pathExists(GAME_STATE_FILE)) {
      const savedState = await fs.readJson(GAME_STATE_FILE);
      gameState = { ...gameState, ...savedState };
      console.log('Game state loaded from file');
    }
  } catch (error) {
    console.error('Error loading game state:', error);
  }
}

// Save game state to file
async function saveGameState() {
  try {
    gameState.lastUpdate = Date.now();
    await fs.writeJson(GAME_STATE_FILE, gameState, { spaces: 2 });
    console.log('Game state saved to file');
  } catch (error) {
    console.error('Error saving game state:', error);
  }
}

// Game logic
class DotsAndDashesGame {
  constructor(size = 6) {
    this.size = size;
    this.grid = this.createGrid();
    this.players = [];
    this.currentPlayer = 0;
    this.scores = [0, 0];
    this.gameOver = false;
    this.lastMove = null;
    this.createdAt = new Date().toISOString();
    this.gameId = Date.now().toString();
  }

  createGrid() {
    const grid = {
      horizontal: {},
      vertical: {},
      boxes: {}
    };
    
    // Initialize horizontal lines
    for (let row = 0; row <= this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const key = `${row}-${col}-h`;
        grid.horizontal[key] = null;
      }
    }
    
    // Initialize vertical lines
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col <= this.size; col++) {
        const key = `${row}-${col}-v`;
        grid.vertical[key] = null;
      }
    }
    
    // Initialize boxes
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const key = `${row}-${col}`;
        grid.boxes[key] = null;
      }
    }
    
    return grid;
  }

  makeMove(playerId, lineType, row, col) {
    if (this.gameOver || this.players[this.currentPlayer] !== playerId) {
      return { success: false, message: 'Invalid move' };
    }

    const key = `${row}-${col}-${lineType}`;
    const lines = lineType === 'h' ? this.grid.horizontal : this.grid.vertical;
    
    if (lines[key] !== null) {
      return { success: false, message: 'Line already drawn' };
    }

    lines[key] = playerId;
    this.lastMove = { type: lineType, row, col, player: playerId };

    // Check for completed boxes
    const completedBoxes = this.checkCompletedBoxes(lineType, row, col);
    let scoreGained = 0;

    if (completedBoxes.length > 0) {
      scoreGained = completedBoxes.length;
      this.scores[this.currentPlayer] += scoreGained;
      
      // Mark completed boxes
      completedBoxes.forEach(boxKey => {
        this.grid.boxes[boxKey] = playerId;
      });
    }

    // Check if game is over
    const totalLines = Object.keys(this.grid.horizontal).length + Object.keys(this.grid.vertical).length;
    const drawnLines = Object.values(this.grid.horizontal).filter(v => v !== null).length + 
                      Object.values(this.grid.vertical).filter(v => v !== null).length;
    
    if (drawnLines >= totalLines) {
      this.gameOver = true;
    }

    // Switch players only if no box was completed
    if (scoreGained === 0) {
      this.currentPlayer = (this.currentPlayer + 1) % 2;
    }

    return {
      success: true,
      completedBoxes,
      scoreGained,
      gameOver: this.gameOver,
      nextPlayer: this.players[this.currentPlayer]
    };
  }

  checkCompletedBoxes(lineType, row, col) {
    const completedBoxes = [];
    
    if (lineType === 'h') {
      // Check boxes above and below the horizontal line
      if (row > 0) {
        const boxKey = `${row - 1}-${col}`;
        if (this.isBoxComplete(boxKey)) {
          completedBoxes.push(boxKey);
        }
      }
      if (row < this.size) {
        const boxKey = `${row}-${col}`;
        if (this.isBoxComplete(boxKey)) {
          completedBoxes.push(boxKey);
        }
      }
    } else {
      // Check boxes to the left and right of the vertical line
      if (col > 0) {
        const boxKey = `${row}-${col - 1}`;
        if (this.isBoxComplete(boxKey)) {
          completedBoxes.push(boxKey);
        }
      }
      if (col < this.size) {
        const boxKey = `${row}-${col}`;
        if (this.isBoxComplete(boxKey)) {
          completedBoxes.push(boxKey);
        }
      }
    }
    
    return completedBoxes;
  }

  isBoxComplete(boxKey) {
    const [row, col] = boxKey.split('-').map(Number);
    const top = `${row}-${col}-h`;
    const bottom = `${row + 1}-${col}-h`;
    const left = `${row}-${col}-v`;
    const right = `${row}-${col + 1}-v`;
    
    return this.grid.horizontal[top] !== null &&
           this.grid.horizontal[bottom] !== null &&
           this.grid.vertical[left] !== null &&
           this.grid.vertical[right] !== null;
  }

  getGameState() {
    return {
      grid: this.grid,
      players: this.players,
      currentPlayer: this.currentPlayer,
      scores: this.scores,
      gameOver: this.gameOver,
      lastMove: this.lastMove,
      gameId: this.gameId,
      createdAt: this.createdAt
    };
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Dots and Dashes API is running!' });
});

// Get current game state
app.get('/api/game', (req, res) => {
  if (gameState.currentGame) {
    res.json({
      success: true,
      gameState: gameState.currentGame.getGameState(),
      lastUpdate: gameState.lastUpdate
    });
  } else {
    res.json({
      success: false,
      message: 'No active game'
    });
  }
});

// Join game
app.post('/api/join', (req, res) => {
  const { playerName, playerId } = req.body;
  
  if (!playerName || !playerId) {
    return res.status(400).json({ success: false, message: 'Player name and ID required' });
  }

  if (gameState.currentGame && gameState.currentGame.players.length < 2) {
    // Join existing game
    if (!gameState.currentGame.players.includes(playerId)) {
      gameState.currentGame.players.push(playerId);
    }
    gameState.players[playerId] = playerName;
    
    saveGameState();
    
    res.json({
      success: true,
      gameState: gameState.currentGame.getGameState(),
      playerId: playerId,
      playerName: playerName
    });
  } else if (!gameState.currentGame) {
    // Create new game
    gameState.currentGame = new DotsAndDashesGame();
    gameState.currentGame.players.push(playerId);
    gameState.players[playerId] = playerName;
    
    saveGameState();
    
    res.json({
      success: true,
      gameState: gameState.currentGame.getGameState(),
      playerId: playerId,
      playerName: playerName
    });
  } else {
    res.json({ success: false, message: 'Game is full' });
  }
});

// Make a move
app.post('/api/move', (req, res) => {
  const { playerId, lineType, row, col } = req.body;
  
  if (!gameState.currentGame || gameState.currentGame.gameOver) {
    return res.status(400).json({ success: false, message: 'No active game' });
  }

  const result = gameState.currentGame.makeMove(playerId, lineType, row, col);

  if (result.success) {
    if (result.gameOver) {
      const winner = gameState.currentGame.scores[0] > gameState.currentGame.scores[1] ? 0 : 1;
      const winnerId = gameState.currentGame.players[winner];
      
      // Save game to history
      gameState.gameHistory.push({
        gameId: gameState.currentGame.gameId,
        players: gameState.currentGame.players.map(id => gameState.players[id]),
        scores: gameState.currentGame.scores,
        winner: gameState.players[winnerId],
        createdAt: gameState.currentGame.createdAt,
        completedAt: new Date().toISOString()
      });
    }

    saveGameState();
    
    res.json({
      success: true,
      gameState: gameState.currentGame.getGameState(),
      completedBoxes: result.completedBoxes,
      scoreGained: result.scoreGained,
      gameOver: result.gameOver
    });
  } else {
    res.status(400).json({ success: false, message: result.message });
  }
});

// Poll for updates
app.get('/api/poll/:lastUpdate', (req, res) => {
  const lastUpdate = parseInt(req.params.lastUpdate);
  
  if (gameState.lastUpdate > lastUpdate) {
    res.json({
      success: true,
      hasUpdate: true,
      gameState: gameState.currentGame ? gameState.currentGame.getGameState() : null,
      lastUpdate: gameState.lastUpdate
    });
  } else {
    res.json({
      success: true,
      hasUpdate: false,
      lastUpdate: gameState.lastUpdate
    });
  }
});

// Get game history
app.get('/api/history', (req, res) => {
  res.json({
    success: true,
    history: gameState.gameHistory.slice(-10) // Last 10 games
  });
});

// Reset game
app.post('/api/reset', (req, res) => {
  gameState.currentGame = null;
  gameState.players = {};
  saveGameState();
  
  res.json({ success: true, message: 'Game reset' });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Load game state on startup
loadGameState();

// Export for Vercel
module.exports = app; 