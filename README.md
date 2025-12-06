# 🎬 CineMind AI - Movie & TV Discovery App

An AI-powered movie and TV show discovery application with intelligent recommendations, natural language search, and personal ratings.

## ✨ Features

### 🤖 AI-Powered Search
- **Dual AI Support**: Choose between Google Gemini or OpenAI for natural language queries
- Understand complex queries like "Dark sci-fi movies like Interstellar from the 2010s"
- Smart genre detection, actor/director search, and year filtering
- Episode ranking for TV shows

### 📱 Cross-Platform Support
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Orientation Support**: Full support for both portrait and landscape modes
- **PWA Ready**: Install as a Progressive Web App
- **Android APK**: Build native Android apps with Capacitor

### ⭐ Personal Ratings
- Rate movies, TV shows, and individual episodes (1-10 stars)
- Ratings automatically sync to Firebase
- Track your viewing history with favorites and watchlist
- Visual rating display with interactive star component

### 🔥 Content Discovery
- Trending movies and TV shows
- Advanced filtering by genre, year, language, and more
- Detailed information including cast, crew, and trailers
- Episode guides with ratings visualization
- Integration with Letterboxd

### ☁️ Cloud Sync
- Google Sign-In for seamless authentication
- Automatic sync of favorites, watchlist, and ratings across devices
- Secure Firebase backend
- API keys stored in cloud for multi-device access

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- TMDB API Key (Required) - [Get it here](https://www.themoviedb.org/settings/api)
- Google Gemini API Key (Optional) - [Get it here](https://aistudio.google.com/app/apikey)
- OpenAI API Key (Optional) - [Get it here](https://platform.openai.com/api-keys)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/AhmadSid110/Cinemind-Ai.git
cd Cinemind-Ai
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:5173 in your browser

### Building for Production

```bash
npm run build
npm run preview
```

## 📱 Building Android APK

See [APK_BUILD_GUIDE.md](APK_BUILD_GUIDE.md) for detailed instructions on building Android APKs.

Quick start:
```bash
# Add Android platform
npm run cap:add:android

# Build and sync
npm run cap:sync

# Open in Android Studio
npm run cap:open
```

## 🔧 Configuration

### API Keys Setup

1. Click the **Settings** icon in the top-right corner
2. Enter your TMDB API Key (required)
3. Optionally add Google Gemini or OpenAI API key for AI search
4. Keys are saved locally and synced to Firebase if signed in

### AI Provider Selection

The app automatically selects the AI provider:
- If OpenAI key is available, it uses OpenAI GPT-4o-mini
- Falls back to Google Gemini if only Gemini key is provided
- Both provide excellent natural language understanding

### Orientation Support

The app now supports both portrait and landscape orientations:
- Automatic adaptation to device orientation
- Optimized layouts for landscape mode
- Compact header and spacing in landscape on small screens

## 🎯 Usage

### Natural Language Search

Simply type what you're looking for:
- "Action movies from 2023"
- "Best episodes of Breaking Bad"
- "Korean drama series"
- "Movies with Tom Hanks"
- "Trending horror films"

### Rating Content

1. Click on any movie or TV show to open details
2. Find the "Your Rating" section
3. Click on stars to rate (1-10)
4. Ratings are saved instantly and synced to cloud

For TV shows:
- Rate the entire show at the top
- Rate individual episodes in the episode list
- Each episode can have its own rating

### Managing Your Library

- ❤️ **Favorites**: Mark content you love
- 📝 **Watchlist**: Save content to watch later
- Filter by type: All, Movies, Series, Animation
- Everything syncs across devices when signed in

## 🔐 Privacy & Security

- API keys are stored securely in Firebase
- All data is associated with your Google account
- No data is shared with third parties
- You can delete your data anytime by signing out

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Backend**: Firebase (Auth + Firestore)
- **AI**: Google Gemini AI & OpenAI
- **Movie Data**: TMDB API
- **Build**: Vite
- **Mobile**: Capacitor

## 📖 Documentation

- [Android Configuration](ANDROID_CONFIG.md) - Android-specific settings
- [APK Build Guide](APK_BUILD_GUIDE.md) - Step-by-step APK building
- [Quick Start APK](QUICK_START_APK.md) - Fast track to Android build

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Movie data provided by [TMDB](https://www.themoviedb.org/)
- AI powered by [Google Gemini](https://ai.google.dev/) and [OpenAI](https://openai.com/)
- Icons by [Lucide React](https://lucide.dev/)

## 📞 Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

Made with ❤️ by the CineMind Team
