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

// Game state management with rooms
let gameState = {
  rooms: {},
  players: {},
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

// Generate room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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
    this.gameHistory = [];
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
      createdAt: this.createdAt,
      gameHistory: this.gameHistory
    };
  }

  resetGame() {
    this.grid = this.createGrid();
    this.currentPlayer = 0;
    this.scores = [0, 0];
    this.gameOver = false;
    this.lastMove = null;
    this.createdAt = new Date().toISOString();
    this.gameId = Date.now().toString();
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Dots and Dashes API is running!' });
});

// Create a new room
app.post('/api/rooms/create', (req, res) => {
  const { playerName, playerId } = req.body;
  
  if (!playerName || !playerId) {
    return res.status(400).json({ success: false, message: 'Player name and ID required' });
  }

  const roomCode = generateRoomCode();
  
  // Create new room
  gameState.rooms[roomCode] = {
    code: roomCode,
    players: [playerId],
    currentGame: null,
    createdAt: new Date().toISOString(),
    lastActivity: Date.now()
  };
  
  gameState.players[playerId] = {
    name: playerName,
    roomCode: roomCode,
    joinedAt: new Date().toISOString()
  };
  
  saveGameState();
  
  res.json({
    success: true,
    roomCode: roomCode,
    playerId: playerId,
    playerName: playerName
  });
});

// Join an existing room
app.post('/api/rooms/join', (req, res) => {
  const { roomCode, playerName, playerId } = req.body;
  
  if (!roomCode || !playerName || !playerId) {
    return res.status(400).json({ success: false, message: 'Room code, player name and ID required' });
  }

  const room = gameState.rooms[roomCode];
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }

  if (room.players.length >= 2) {
    return res.status(400).json({ success: false, message: 'Room is full' });
  }

  if (room.players.includes(playerId)) {
    return res.status(400).json({ success: false, message: 'Player already in room' });
  }

  // Add player to room
  room.players.push(playerId);
  room.lastActivity = Date.now();
  
  gameState.players[playerId] = {
    name: playerName,
    roomCode: roomCode,
    joinedAt: new Date().toISOString()
  };
  
  saveGameState();
  
  res.json({
    success: true,
    roomCode: roomCode,
    playerId: playerId,
    playerName: playerName,
    room: room
  });
});

// Get room info
app.get('/api/rooms/:roomCode', (req, res) => {
  const { roomCode } = req.params;
  
  const room = gameState.rooms[roomCode];
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }

  // Get player names
  const playerNames = room.players.map(playerId => gameState.players[playerId]?.name || 'Unknown');
  
  res.json({
    success: true,
    room: {
      ...room,
      playerNames: playerNames
    }
  });
});

// Start a new game in a room
app.post('/api/rooms/:roomCode/start', (req, res) => {
  const { roomCode } = req.params;
  const { playerId } = req.body;
  
  const room = gameState.rooms[roomCode];
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }

  if (!room.players.includes(playerId)) {
    return res.status(403).json({ success: false, message: 'Not in this room' });
  }

  if (room.players.length < 2) {
    return res.status(400).json({ success: false, message: 'Need 2 players to start' });
  }

  // Create new game
  const game = new DotsAndDashesGame();
  game.players = room.players;
  room.currentGame = game;
  room.lastActivity = Date.now();
  
  saveGameState();
  
  res.json({
    success: true,
    gameState: game.getGameState()
  });
});

// Get current game state
app.get('/api/rooms/:roomCode/game', (req, res) => {
  const { roomCode } = req.params;
  
  const room = gameState.rooms[roomCode];
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }

  if (!room.currentGame) {
    return res.json({
      success: false,
      message: 'No active game'
    });
  }

  res.json({
    success: true,
    gameState: room.currentGame.getGameState(),
    lastUpdate: gameState.lastUpdate
  });
});

// Make a move
app.post('/api/rooms/:roomCode/move', (req, res) => {
  const { roomCode } = req.params;
  const { playerId, lineType, row, col } = req.body;
  
  const room = gameState.rooms[roomCode];
  if (!room || !room.currentGame || room.currentGame.gameOver) {
    return res.status(400).json({ success: false, message: 'No active game' });
  }

  if (!room.players.includes(playerId)) {
    return res.status(403).json({ success: false, message: 'Not in this room' });
  }

  const result = room.currentGame.makeMove(playerId, lineType, row, col);

  if (result.success) {
    if (result.gameOver) {
      const winner = room.currentGame.scores[0] > room.currentGame.scores[1] ? 0 : 1;
      const winnerId = room.players[winner];
      
      // Save game to history
      room.currentGame.gameHistory.push({
        gameId: room.currentGame.gameId,
        players: room.currentGame.players.map(id => gameState.players[id]?.name || 'Unknown'),
        scores: room.currentGame.scores,
        winner: gameState.players[winnerId]?.name || 'Unknown',
        createdAt: room.currentGame.createdAt,
        completedAt: new Date().toISOString()
      });
    }

    room.lastActivity = Date.now();
    saveGameState();
    
    res.json({
      success: true,
      gameState: room.currentGame.getGameState(),
      completedBoxes: result.completedBoxes,
      scoreGained: result.scoreGained,
      gameOver: result.gameOver
    });
  } else {
    res.status(400).json({ success: false, message: result.message });
  }
});

// Poll for updates
app.get('/api/rooms/:roomCode/poll/:lastUpdate', (req, res) => {
  const { roomCode } = req.params;
  const lastUpdate = parseInt(req.params.lastUpdate);
  
  const room = gameState.rooms[roomCode];
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  
  if (gameState.lastUpdate > lastUpdate) {
    res.json({
      success: true,
      hasUpdate: true,
      room: room,
      gameState: room.currentGame ? room.currentGame.getGameState() : null,
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

// Reset game
app.post('/api/rooms/:roomCode/reset', (req, res) => {
  const { roomCode } = req.params;
  const { playerId } = req.body;
  
  const room = gameState.rooms[roomCode];
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }

  if (!room.players.includes(playerId)) {
    return res.status(403).json({ success: false, message: 'Not in this room' });
  }

  if (room.currentGame) {
    room.currentGame.resetGame();
  }
  
  room.lastActivity = Date.now();
  saveGameState();
  
  res.json({ success: true, message: 'Game reset' });
});

// Leave room
app.post('/api/rooms/:roomCode/leave', (req, res) => {
  const { roomCode } = req.params;
  const { playerId } = req.body;
  
  const room = gameState.rooms[roomCode];
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }

  // Remove player from room
  room.players = room.players.filter(id => id !== playerId);
  delete gameState.players[playerId];
  
  // If room is empty, delete it
  if (room.players.length === 0) {
    delete gameState.rooms[roomCode];
  } else {
    room.lastActivity = Date.now();
  }
  
  saveGameState();
  
  res.json({ success: true, message: 'Left room' });
});

// Get game history
app.get('/api/rooms/:roomCode/history', (req, res) => {
  const { roomCode } = req.params;
  
  const room = gameState.rooms[roomCode];
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }

  const history = room.currentGame ? room.currentGame.gameHistory : [];
  
  res.json({
    success: true,
    history: history.slice(-10) // Last 10 games
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Load game state on startup
loadGameState();

// Export for Vercel
module.exports = app; 