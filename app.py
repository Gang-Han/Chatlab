import os
import sys

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request
from openai import OpenAI

load_dotenv()

api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("Missing OPENAI_API_KEY. Copy .env.example to .env and add your key.")
    sys.exit(1)

client = OpenAI(api_key=api_key)

app = Flask(__name__, static_folder="public", static_url_path="")

SYSTEM_PROMPT = "You are ChatLab, a helpful assistant."


def sanitize_turns(value):
    turns = []
    if isinstance(value, list):
        for entry in value:
            if not isinstance(entry, dict):
                continue
            role = entry.get("role")
            content = entry.get("content")
            if role in ("user", "assistant") and isinstance(content, str):
                turns.append({"role": role, "content": content})
    return turns


def sanitize_highlights(value):
    highlights = []
    if isinstance(value, list):
        for entry in value:
            if not isinstance(entry, dict):
                continue
            text = entry.get("text")
            if isinstance(text, str) and text:
                note = entry.get("note")
                highlights.append({"text": text, "note": note if isinstance(note, str) else ""})
    return highlights


def build_context_messages(project_summary, summary, highlights, recent_turns):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if project_summary:
        messages.append({"role": "system", "content": f"Project background:\n{project_summary}"})

    if summary:
        messages.append({"role": "system", "content": f"Summary of earlier conversation:\n{summary}"})

    if highlights:
        lines = []
        for h in highlights:
            line = f'- "{h["text"]}"'
            if h["note"]:
                line += f" (note: {h['note']})"
            lines.append(line)
        messages.append({
            "role": "system",
            "content": "User-highlighted excerpts from this conversation:\n" + "\n".join(lines)
        })

    messages.extend(recent_turns)
    return messages


def update_summary(existing_summary, turns_to_fold):
    transcript = "\n".join(f"{t['role']}: {t['content']}" for t in turns_to_fold)
    prompt = (
        "You maintain a running summary of an ongoing chat conversation. "
        "Update the summary to incorporate the new messages below, keeping it concise "
        "and preserving important facts, decisions, and context.\n\n"
        f"Existing summary:\n{existing_summary or '(none yet)'}\n\n"
        f"New messages to fold in:\n{transcript}\n\n"
        "Return only the updated summary text."
    )
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return completion.choices[0].message.content.strip()


@app.route("/")
def index():
    return redirect("/index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    question = data.get("question")

    if not question or not isinstance(question, str):
        return jsonify({"error": "Please provide a question."}), 400

    project_summary = data.get("projectSummary")
    if not isinstance(project_summary, str):
        project_summary = ""
    summary = data.get("summary") or ""
    recent_turns = sanitize_turns(data.get("recentTurns"))
    highlights = sanitize_highlights(data.get("highlights"))
    to_summarize = sanitize_turns(data.get("toSummarize"))

    messages = build_context_messages(project_summary, summary, highlights, recent_turns)
    messages.append({"role": "user", "content": question})

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
        )
        answer = completion.choices[0].message.content
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return jsonify({"error": "Something went wrong calling the OpenAI API."}), 500

    updated_summary = summary
    if to_summarize:
        try:
            updated_summary = update_summary(summary, to_summarize)
        except Exception as e:
            print(f"Summary update error: {e}")

    return jsonify({"answer": answer, "summary": updated_summary})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port, debug=True)
