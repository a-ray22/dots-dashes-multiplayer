const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const GAME_STATE_FILE = process.env.NODE_ENV === 'production' 
  ? '/tmp/gameState.json' 
  : path.join(__dirname, 'gameState.json');

// Serve static files
app.use(express.static('public'));

// Game state management
let gameState = {
  players: {},
  currentGame: null,
  gameHistory: []
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join game
  socket.on('joinGame', (playerName) => {
    if (gameState.currentGame && gameState.currentGame.players.length < 2) {
      // Join existing game
      gameState.currentGame.players.push(socket.id);
      gameState.players[socket.id] = playerName;
      
      socket.join('game');
      socket.emit('gameJoined', {
        gameState: gameState.currentGame.getGameState(),
        playerId: socket.id,
        playerName: playerName
      });
      
      io.to('game').emit('playerJoined', {
        players: gameState.currentGame.players.map(id => gameState.players[id]),
        gameState: gameState.currentGame.getGameState()
      });
      
      saveGameState();
    } else if (!gameState.currentGame) {
      // Create new game
      gameState.currentGame = new DotsAndDashesGame();
      gameState.currentGame.players.push(socket.id);
      gameState.players[socket.id] = playerName;
      
      socket.join('game');
      socket.emit('gameJoined', {
        gameState: gameState.currentGame.getGameState(),
        playerId: socket.id,
        playerName: playerName
      });
      
      saveGameState();
    } else {
      socket.emit('gameFull');
    }
  });

  // Make a move
  socket.on('makeMove', (data) => {
    if (!gameState.currentGame || gameState.currentGame.gameOver) {
      return;
    }

    const result = gameState.currentGame.makeMove(
      socket.id,
      data.lineType,
      data.row,
      data.col
    );

    if (result.success) {
      io.to('game').emit('moveMade', {
        move: { lineType: data.lineType, row: data.row, col: data.col },
        gameState: gameState.currentGame.getGameState(),
        completedBoxes: result.completedBoxes,
        scoreGained: result.scoreGained,
        gameOver: result.gameOver
      });

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

        io.to('game').emit('gameOver', {
          winner: gameState.players[winnerId],
          scores: gameState.currentGame.scores
        });

        // Clear current game after a delay
        setTimeout(() => {
          gameState.currentGame = null;
          saveGameState();
        }, 5000);
      }

      saveGameState();
    } else {
      socket.emit('moveError', result.message);
    }
  });

  // Request game state
  socket.on('getGameState', () => {
    if (gameState.currentGame) {
      socket.emit('gameState', gameState.currentGame.getGameState());
    } else {
      socket.emit('noActiveGame');
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (gameState.currentGame && gameState.currentGame.players.includes(socket.id)) {
      // Player disconnected during active game
      io.to('game').emit('playerDisconnected', {
        playerName: gameState.players[socket.id],
        playerId: socket.id
      });
      
      // Don't clear the game immediately - give time for reconnection
      setTimeout(() => {
        if (gameState.currentGame && gameState.currentGame.players.includes(socket.id)) {
          // Player didn't reconnect, end the game
          gameState.currentGame.gameOver = true;
          io.to('game').emit('gameEnded', {
            reason: 'Player disconnected',
            gameState: gameState.currentGame.getGameState()
          });
          
          // Save to history
          gameState.gameHistory.push({
            gameId: gameState.currentGame.gameId,
            players: gameState.currentGame.players.map(id => gameState.players[id]),
            scores: gameState.currentGame.scores,
            winner: 'Disconnected',
            createdAt: gameState.currentGame.createdAt,
            completedAt: new Date().toISOString()
          });
          
          gameState.currentGame = null;
          saveGameState();
        }
      }, 30000); // 30 second timeout
    }
    
    delete gameState.players[socket.id];
    saveGameState();
  });
});

// Load game state on startup
loadGameState().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nSaving game state before shutdown...');
  await saveGameState();
  process.exit(0);
}); 