import json
import os

UNDO_FILE = "undo.json"


def load_undo():
    if not os.path.exists(UNDO_FILE):
        return {}
    return json.load(open(UNDO_FILE))


def save_undo(data):
    json.dump(data, open(UNDO_FILE, "w"), indent=2)


def apply_patch(file_path, original, patch):
    try:
        find = patch.split("FIND:")[1].split("REPLACE:")[0].strip()
        replace = patch.split("REPLACE:")[1].strip()

        if find not in original:
            return None, "Pattern not found"

        # save undo
        undo = load_undo()
        undo[file_path] = original
        save_undo(undo)

        new_text = original.replace(find, replace, 1)
        return new_text, "Patched"

    except:
        return None, "Invalid patch"


def undo(file_path, file_system):
    undo_data = load_undo()

    if file_path not in undo_data:
        return "Nothing to undo"

    file_system.write_file(file_path, undo_data[file_path])
    return "Undo successful"