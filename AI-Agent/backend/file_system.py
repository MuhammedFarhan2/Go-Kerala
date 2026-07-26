import os

WORKSPACE = "../workspace"


def read_file(path):
    full = os.path.join(WORKSPACE, path)
    with open(full, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path, content):
    full = os.path.join(WORKSPACE, path)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)


def list_files():
    files = []
    for root, _, fns in os.walk(WORKSPACE):
        for f in fns:
            files.append(os.path.relpath(os.path.join(root, f), WORKSPACE))
    return files