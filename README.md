# Dots & Dashes - Multiplayer Game

A beautiful, modern multiplayer dots and dashes game that you can play with your girlfriend or friends online! Built with Node.js, Socket.IO, and a responsive web interface.

## Features

- 🎮 **Real-time multiplayer gameplay** - Play with friends in real-time
- 💾 **Game state persistence** - Game progress is saved even if players disconnect
- 🎨 **Beautiful UI** - Modern, responsive design with smooth animations
- 📱 **Mobile-friendly** - Works great on desktop and mobile devices
- 🌙 **Dark mode support** - Automatic dark/light theme detection
- 🔄 **Auto-reconnection** - Automatically reconnects if connection is lost
- 📊 **Game history** - View recent games and scores
- 🎯 **Score tracking** - Real-time score updates and animations

## How to Play

1. **Connect dots** - Click on two adjacent dots to draw a line between them
2. **Complete boxes** - When you complete a box by drawing the fourth line, you score a point and get another turn
3. **Win the game** - The player with the most completed boxes wins!

## Installation & Setup

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Quick Start

1. **Clone or download the project**
   ```bash
   # If you have git installed
   git clone <repository-url>
   cd dots-and-dashes-game
   
   # Or just download and extract the ZIP file
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in your browser**
   - Open `http://localhost:3000` in your browser
   - Share the URL with your girlfriend/friend to play together!

### Development Mode

For development with auto-restart on file changes:
```bash
npm run dev
```

## How to Play with Your Girlfriend

1. **Start the server** on your computer
2. **Open the game** in your browser at `http://localhost:3000`
3. **Enter your name** and click "Join Game"
4. **Share the URL** with your girlfriend (she needs to be on the same network or you need to expose the port)
5. **She opens the URL** and enters her name to join
6. **Start playing!** The game will automatically sync between both players

### Playing Over the Internet

To play with someone not on your local network:

1. **Find your IP address**
   ```bash
   # On Mac/Linux
   ifconfig
   
   # On Windows
   ipconfig
   ```

2. **Configure your firewall** to allow connections on port 3000

3. **Share the URL** with your girlfriend: `http://YOUR_IP_ADDRESS:3000`

4. **She can now connect** from anywhere in the world!

## Game Features

### Real-time Multiplayer
- Instant game state synchronization
- Live player status indicators
- Real-time score updates
- Turn-based gameplay

### Game State Persistence
- Game progress is automatically saved
- If a player disconnects, the game waits 30 seconds for reconnection
- Game history is preserved between sessions
- Automatic recovery from server restarts

### Beautiful UI
- Handwritten-style fonts for a personal touch
- Smooth animations for moves and completions
- Responsive design that works on all devices
- Graph paper background for authentic feel
- Color-coded players (blue vs red)

### Smart Game Logic
- Automatic box completion detection
- Extra turns when completing boxes
- Game over detection
- Winner determination

## File Structure

```
dots-and-dashes-game/
├── server.js              # Main server file with Socket.IO
├── package.json           # Dependencies and scripts
├── gameState.json         # Saved game state (created automatically)
├── public/                # Frontend files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styles
│   └── game.js            # Frontend JavaScript
└── README.md              # This file
```

## Customization

### Changing Game Size
Edit `gameSize` in `public/game.js`:
```javascript
let gameSize = 6; // Change to 4 for smaller, 8 for larger
```

### Changing Colors
Edit the CSS variables in `public/styles.css`:
```css
.line.player1 {
    background: #3B82F6; /* Blue for player 1 */
}

.line.player2 {
    background: #EF4444; /* Red for player 2 */
}
```

### Changing Port
Edit the port in `server.js`:
```javascript
const PORT = process.env.PORT || 3000; // Change 3000 to your preferred port
```

## Troubleshooting

### "Connection refused" error
- Make sure the server is running (`npm start`)
- Check if port 3000 is available
- Try a different port if needed

### Players can't connect
- Check your firewall settings
- Make sure both players are using the same URL
- Try using your computer's IP address instead of localhost

### Game not saving progress
- Check if the `gameState.json` file is being created
- Make sure the server has write permissions in the directory

### Mobile issues
- The game is designed to work on mobile, but some older browsers might have issues
- Try using Chrome or Safari on mobile devices

## Technical Details

### Backend (Node.js + Socket.IO)
- Real-time communication using Socket.IO
- Game state management and validation
- Automatic game state persistence to JSON file
- Player connection management with reconnection support

### Frontend (Vanilla JavaScript)
- Responsive design with CSS Grid and Flexbox
- Real-time UI updates via Socket.IO
- Touch-friendly interface for mobile devices
- Smooth animations and transitions

### Game Logic
- Grid-based game board with dots and lines
- Automatic box completion detection
- Turn-based gameplay with extra turns for box completion
- Win condition detection

## Contributing

Feel free to improve the game! Some ideas:
- Add sound effects
- Implement different game modes
- Add AI opponents
- Create tournament brackets
- Add chat functionality
- Implement different board sizes

## License

This project is open source and available under the MIT License.

## Support

If you have any issues or questions:
1. Check the troubleshooting section above
2. Make sure all dependencies are installed correctly
3. Try restarting the server
4. Check the browser console for error messages

Enjoy playing Dots & Dashes with your girlfriend! 🎮💕 