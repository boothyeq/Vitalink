import os

file_path = r'vitalink/server/server.js'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
garbage_start_marker = "if(r.error) return res.status(400).json({ error: r.error.message })"
garbage_end_marker = "app.get('/admin/auth-generate-link'"

for i, line in enumerate(lines):
    if garbage_start_marker in line and not skip:
        # Check if we are inside the 'out' object (indentation check or context)
        # The garbage line has indentation.
        # We assume this is the specific occurrence we want to remove.
        skip = True
        new_lines.append("    }\n")
        new_lines.append("  }\n")
        new_lines.append("  return res.status(200).json(out)\n")
        new_lines.append("})\n")
        continue

    if skip:
        if garbage_end_marker in line:
            skip = False
            new_lines.append(line)
        continue
    
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Fixed server.js")
