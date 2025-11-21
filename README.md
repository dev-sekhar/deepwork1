<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Deep Work Time Manager

A powerful, AI-enhanced productivity tool designed to help you master your time, sustain focus, and achieve your goals through structured deep work sessions.

## 🚀 Features

### 📅 Smart Scheduling
- **Flexible Views**: Manage your tasks with Daily, Weekly, Monthly, and One-Time views.
- **Task Types**: Categorize work into **Deep Work**, **Shallow Work**, and **AI Assisted Work**.
- **Recurring Tasks**: Easily set up daily, weekly, or monthly repeating tasks.

### 🧘 Focus Mode
- **Distraction-Free Interface**: A clean, timer-based interface to keep you on track.
- **Pre-Session Checklist**: Prepare your mind and environment before diving into deep work.
- **Rituals**: Define and track start/end rituals to build consistent habits.

### 🤖 AI Integration (Powered by Google Gemini)
- **Task Classification**: AI analyzes your tasks to suggest the best work type (Deep vs. Shallow).
- **Post-Session Analysis**: Get AI-driven insights on your focus quality and productivity.
- **Voice Assistant**: Create tasks and manage your schedule using voice commands.
- **AI Chat**: Context-aware assistance during your work sessions.

### 📊 Analytics & History
- **Dashboard**: Visualize your productivity with charts and key metrics.
- **History View**: Review past sessions, completion status, and feedback.
- **Detailed Logs**: Track application events for debugging and transparency.

### ⚙️ Customization
- **Themes**: Choose from various color themes to suit your preference.
- **Settings**: Configure application behavior and preferences.

## 🏗️ Architecture

This application is built with a modern, performance-focused stack:

- **Frontend Framework**: [React](https://react.dev/) (v19)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **AI Provider**: [Google Gemini API](https://ai.google.dev/) via `@google/genai`

### Project Structure

- `src/components`: UI components (Modals, Views, Reusable elements).
- `src/services`: Logic for AI, Logging, and Settings.
- `src/hooks`: Custom React hooks.
- `src/utils`: Helper functions.
- `src/types.ts`: TypeScript definitions for the application domain.

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js** (v20 or higher recommended)
- **Yarn** package manager
- **Google Gemini API Key**: Get one [here](https://aistudio.google.com/app/apikey).

### Steps

1.  **Clone the repository** (if applicable) or navigate to the project directory.

2.  **Install dependencies**:
    ```bash
    yarn install
    ```

3.  **Configure Environment Variables**:
    Create a `.env.local` file in the root directory and add your API key and desired port:
    ```env
    GEMINI_API_KEY=your_actual_api_key_here
    PORT=4000
    ```

## 🏃‍♂️ Running the Application

Start the development server:
```bash
yarn dev
```
The application will start (defaulting to port 4000 or the next available port) and open in your browser.

## 📦 Building for Production

To create a production-ready build:
```bash
yarn build
```
The output will be generated in the `dist` directory.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
