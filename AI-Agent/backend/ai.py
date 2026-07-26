import ollama

MODEL = "deepseek-coder"


def ask_ai(prompt):
    response = ollama.chat(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": """
You are a Cursor-like AI coding assistant.

You can:
- edit multiple files
- suggest changes across project
- return structured edits

RULE:
If multiple files are needed, respond like:

FILE: path/to/file.py
FIND:
...
REPLACE:
...

FILE: path/to/another.py
FIND:
...
REPLACE:
...
"""
            },
            {"role": "user", "content": prompt}
        ]
    )

    return response["message"]["content"]