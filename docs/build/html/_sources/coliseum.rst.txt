Lexicon Coliseum & The Iron Chain
===================================

The **Lexicon Coliseum** is DECIPHER's real-time 1v1 linguistic arena, transforming passive vocabulary acquisition into competitive, active cognitive mastery.

Architecture Overview
---------------------
The arena is structured into four modular sub-layers:

1. **60fps Physics Loop (`modules/arena/iron-chain.js`)**:
   Maintains dynamic chain tension on a normalized ``[0.0, 1.0]`` continuum.
   Sudden death occurs if tension reaches ``<= 0.05`` (player KO) or ``>= 0.95`` (bot KO).
   Applies continuous momentum decay (drift to center) to prevent static play.

2. **Lexical Weight Scoring (`modules/arena/lexical-weight.js`)**:
   Grades input words against the CEFR lexicon:
   - A1: 10 kg
   - A2: 25 kg
   - B1: 80 kg
   - B2: 150 kg
   - C1: 300 kg
   - C2: 500 kg (Critical Hit)
   - Filler words (like, basically, literally): -50 kg penalty (Cognitive Freeze)
   - Active SRS due-card bonus: 1.5x multiplier

3. **Simulated AI Archetypes (`modules/arena/bot-controller.js`)**:
   Provides human-like simulated rivals with realistic typing jitter and miss rates:
   - **Rookie (🥉)**: A1/A2 vocabulary, 28 WPM base, 0.40 jitter, 25% miss rate.
   - **Scholar (🥈)**: B1/B2 vocabulary, 52 WPM base, 0.20 jitter, 10% miss rate.
   - **Grand Inquisitor (🥇)**: C1/C2 vocabulary, 78 WPM base, 0.08 jitter, 3% miss rate.

4. **Procedural Web Audio SFX (`modules/arena/audio-sfx.js`)**:
   Zero-asset audio synthesis utilizing Web Audio API oscillators for metallic chain clanks, combo arpeggios, critical pings, and heartbeat tension.
