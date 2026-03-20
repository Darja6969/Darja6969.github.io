# Emotion Detection Web App

This project uses the browser camera and `face-api.js` to detect facial emotions:
- happy
- sad
- neutral
- angry

The full app background changes automatically based on the dominant detected emotion.

## Run

The easiest way is to open the project via a local server (not as a direct file), for example using VS Code Live Server.

Alternative with Python:

```bash
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

## Files

- `index.html` - app structure
- `styles.css` - visual design and emotion-based backgrounds
- `app.js` - camera setup, model loading, and emotion detection
