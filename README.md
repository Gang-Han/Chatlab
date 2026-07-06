# ChatLab

ChatLab is a lightweight web chatbot built on the OpenAI API, with conversation history, project-based organization, and automatic memory management so long-running chats stay coherent without sending unbounded context to the model.

## Features

- **Chat via OpenAI API** — powered by `gpt-4o-mini`.
- **Conversation history** — a sidebar of past conversations with rename/delete, auto-titled from the first message.
- **Conversation rolling memory** — each conversation keeps only its most recent raw turns in the API request; older turns are automatically folded into a rolling summary instead of being sent in full every time.
- **Projects** — group related conversations together.
- **Project background** — a manually-editable, long-lived note attached to a project for background context.
- **Automatic project-level rolling memory** — as conversations in a project progress, a project-wide summary updates automatically, so new conversations in that project inherit relevant context.
- **Highlights & notes** — select any assistant response to save it as a highlight with an optional note, then generate a consolidated notes document from them.
- **BTW side chat** — ask a quick, temporary follow-up about one specific response in a separate modal, without it ever entering the main conversation's history, summary, or memory. Highlighting text from inside a BTW side chat is also supported.

## Tech stack

- **Backend:** Python + Flask, calling the OpenAI API directly (no framework/agent library).
- **Frontend:** plain HTML/CSS/JavaScript — no build step, no framework.
- **Storage:** browser `localStorage` only — no database.
- **Deployment:** Vercel.

## Local setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and add your key:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```
3. Run the app:
   ```
   python app.py
   ```
   (Windows users can also double-click `Start ChatLab.bat`, which starts the server and opens the browser automatically.)
4. Open `http://localhost:3000`.

## Deployed site

<!-- TODO: add deployed URL -->
