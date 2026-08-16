# Push-Up Counter

## Features
- Real-time body tracking via webcam using MediaPipe
- Push-up rep counting using state machine
- Clean, minimal, high-contrast mobile responsive UI
- Privacy-focused: All video processing runs locally in your browser, and no video frames are uploaded anywhere.

## Requirements
- Node.js 18+
- Modern browser with camera support (Chrome, Safari, Firefox, Edge)

## Installation
```bash
npm install
```

## Testing
Run unit tests for the core logic:
```bash
npx vitest run
```

## Development
```bash
npm run dev
```

## Cloudflare Preview
```bash
npm run preview
```

## Deployment
```bash
npm run deploy
```

## Architecture
Camera → MediaPipe → Landmarks → Pose Analysis → Push-up State Machine → Counter

## Privacy
Your camera video is processed locally on your device. Video is not uploaded. The application only temporarily processes webcam streams for pose estimation directly within your browser.
