const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Player data storage
const playerDataFile = 'playerData.json';
let playerData = {};

// Load existing player data
try {
    if (fs.existsSync(playerDataFile)) {
        playerData = JSON.parse(fs.readFileSync(playerDataFile, 'utf8'));
    }
} catch (err) {
    console.error('Error loading player data:', err);
    playerData = {};
}

// Save player data to file
function savePlayerData() {
    fs.writeFileSync(playerDataFile, JSON.stringify(playerData, null, 2));
}

// Get current top score
function getTopScore() {
    const scores = Object.values(playerData)
        .map(data => data.highScore)
        .sort((a, b) => b - a);
    return scores[0] || 0;
}

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// API endpoints
app.post('/api/player/update', (req, res) => {
    const { walletAddress, score, name } = req.body;
    
    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Create new player account if it doesn't exist
    if (!playerData[walletAddress]) {
        playerData[walletAddress] = {
            name: name || 'Anonymous',
            highScore: 0,
            totalCoins: 0,
            gamesPlayed: 0,
            createdAt: new Date().toISOString(),
            isVerified: false
        };
    }

    const currentTopScore = getTopScore();
    let coinsEarned = 0;
    let beatTopScore = false;

    // Award exactly one coin if player beats the top score
    if (score > currentTopScore) {
        coinsEarned = 1;
        playerData[walletAddress].totalCoins += coinsEarned;
        beatTopScore = true;
    }

    // Update player data
    playerData[walletAddress].highScore = Math.max(playerData[walletAddress].highScore, score);
    playerData[walletAddress].gamesPlayed += 1;
    if (name) {
        playerData[walletAddress].name = name;
    }

    // Save to file
    savePlayerData();

    res.json({
        ...playerData[walletAddress],
        coinsEarned,
        beatTopScore
    });
});

app.get('/api/player/:walletAddress', (req, res) => {
    const { walletAddress } = req.params;
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    if (!playerData[walletAddress]) {
        // Return default data for new players
        return res.json({
            name: 'Anonymous',
            highScore: 0,
            totalCoins: 0,
            gamesPlayed: 0,
            createdAt: new Date().toISOString(),
            isVerified: false
        });
    }

    res.json(playerData[walletAddress]);
});

app.get('/api/leaderboard', (req, res) => {
    const leaderboard = Object.entries(playerData)
        .map(([wallet, data]) => ({
            wallet,
            name: data.name,
            highScore: data.highScore,
            totalCoins: data.totalCoins,
            gamesPlayed: data.gamesPlayed,
            isVerified: data.isVerified
        }))
        .sort((a, b) => b.highScore - a.highScore)
        .slice(0, 10);

    res.json(leaderboard);
});

// Serve the main HTML file for all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 