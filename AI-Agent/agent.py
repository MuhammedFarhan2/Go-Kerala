import ollama
import os
import json

MODEL = "deepseek-coder"
WORKSPACE = os.path.dirname(os.path.abspath(__file__))
MEMORY_FILE = "memory.json"


# ---------------- MEMORY SYSTEM ----------------

def load_memory():
    if not os.path.exists(MEMORY_FILE):
        return {}

    try:
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    except:
        return {}


def save_memory(memory):
    with open(MEMORY_FILE, "w") as f:
        json.dump(memory, f, indent=2)


def update_memory(key, value):
    memory = load_memory()
    memory[key] = value
    save_memory(memory)


# ---------------- FILE SYSTEM ----------------

def read_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return str(e)


def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


# ---------------- SAFE PATCH ENGINE ----------------

def apply_patch(original_text, patch):
    try:
        if "FIND:" not in patch or "REPLACE:" not in patch:
            return None, "❌ Invalid patch format"

        find_block = patch.split("FIND:")[1].split("REPLACE:")[0].strip()
        replace_block = patch.split("REPLACE:")[1].strip()

        if find_block not in original_text:
            return None, "❌ Pattern not found in file"

        new_text = original_text.replace(find_block, replace_block, 1)
        return new_text, "✅ Patch applied successfully"

    except Exception as e:
        return None, f"❌ Patch error: {str(e)}"


# ---------------- AI ENGINE ----------------

def ask_ai(prompt):
    memory = load_memory()

    response = ollama.chat(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": f"""
You are a Cursor-like AI coding assistant.

PROJECT MEMORY:
{memory}

RULES:
- If editing code, DO NOT return full file
- Return ONLY patches in this format:

FIND:
(old code)

REPLACE:
(new code)

- No explanations, only patch
"""
            },
            {"role": "user", "content": prompt}
        ]
    )

    return response["message"]["content"]


# ---------------- MAIN LOOP ----------------

def main():
    print("🤖 Cursor-like AI Agent Started (Safe Edit Mode)")

    while True:
        user = input("\n💬 You: ")

        if user.lower() in ["exit", "quit"]:
            break

        # READ FILE
        if user.startswith("read "):
            path = user[5:]
            print("\n📄 File Content:\n", read_file(path))
            continue

        # SAFE EDIT MODE
        if user.startswith("edit "):
            path = user[5:]
            old_content = read_file(path)

            prompt = f"""
File path: {path}

Current file:
{old_content}

User request:
{user}

Return ONLY PATCH in FIND/REPLACE format.
"""

            patch = ask_ai(prompt)

            new_content, status = apply_patch(old_content, patch)

            if new_content:
                write_file(path, new_content)
                print("\n", status)
            else:
                print("\n", status)
                print("\nAI PATCH WAS:\n", patch)

            continue

        # NORMAL CHAT
        reply = ask_ai(user)
        print("\n🤖 AI:", reply)


if __name__ == "__main__":
    main()