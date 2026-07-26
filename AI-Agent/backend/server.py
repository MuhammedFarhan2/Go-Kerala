from fastapi import FastAPI
from ai import ask_ai
from file_system import read_file, write_file, list_files
from patch_engine import apply_patch, undo

app = FastAPI()


@app.get("/files")
def files():
    return list_files()


@app.get("/read")
def read(path: str):
    return read_file(path)


@app.post("/chat")
def chat(prompt: str):
    return {"response": ask_ai(prompt)}


@app.post("/edit")
def edit(path: str, prompt: str):
    content = read_file(path)

    ai_prompt = f"""
File: {path}

Content:
{content}

User request:
{prompt}

Return PATCH only.
"""

    patch = ask_ai(ai_prompt)
    new, status = apply_patch(path, content, patch)

    if new:
        write_file(path, new)

    return {"status": status, "patch": patch}


@app.post("/undo")
def undo_file(path: str):
    return {"status": undo(path, __import__("file_system"))}