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


@app.route("/")
def index():
    return redirect("/index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    question = data.get("question")

    if not question or not isinstance(question, str):
        return jsonify({"error": "Please provide a question."}), 400

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": question}],
        )
        answer = completion.choices[0].message.content
        return jsonify({"answer": answer})
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return jsonify({"error": "Something went wrong calling the OpenAI API."}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port, debug=True)
