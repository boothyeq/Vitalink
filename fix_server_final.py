import os

file_path = r'vitalink/server/server.js'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the start of the garbage
start_line_idx = -1
for i, line in enumerate(lines):
    if 'if(r.error) return res.status(400).json({ error: r.error.message })' in line:
        start_line_idx = i
        break

if start_line_idx == -1:
    print("Garbage start not found")
    exit(1)

# Find the end of the garbage
end_line_idx = -1
for i in range(start_line_idx, len(lines)):
    if 'return res.status(200).json({ data, callback_link, verify_link })' in lines[i]:
        # The next line should be '  })'
        if i + 1 < len(lines) and '})' in lines[i+1]:
            end_line_idx = i + 1
            break

if end_line_idx == -1:
    print("Garbage end not found")
    exit(1)

fixed_block = [
    "    }\n",
    "  }\n",
    "  return res.status(200).json(out)\n",
    "})\n"
]

new_lines = lines[:start_line_idx] + fixed_block + lines[end_line_idx+1:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed server.js")
