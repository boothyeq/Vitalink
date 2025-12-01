import os

file_path = r'vitalink/server/server.js'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'out = {' in line and start_idx == -1:
        start_idx = i
    if "app.get('/admin/auth-generate-link'" in line and end_idx == -1:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    fixed_content = [
        "      hr: hrDays.map((r) => ({ time: r.date, min: Math.round(r.hr_min || 0), avg: Math.round(r.hr_avg || 0), max: Math.round(r.hr_max || 0), resting: restingMap.get(r.date) })),\n",
        "      spo2: (spo2.data || []).map((r) => ({ time: r.date, min: Math.round(r.spo2_min || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round(r.spo2_max || 0) })),\n",
        "      steps: (steps.data || []).map((r) => ({ time: r.date, count: Math.round(r.steps_total || 0) })),\n",
        "      bp: (bp.data || []).map((r) => ({\n",
        "        time: `${r.reading_date}T${r.reading_time}`,\n",
        "        systolic: r.systolic,\n",
        "        diastolic: r.diastolic,\n",
        "        pulse: r.pulse\n",
        "      })),\n",
        "      weight: [],\n",
        "    }\n",
        "  }\n",
        "  return res.status(200).json(out)\n",
        "})\n",
        "\n"
    ]
    
    new_lines = lines[:start_idx+1] + fixed_content + lines[end_idx:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Fixed server.js successfully")
else:
    print(f"Could not find markers. Start: {start_idx}, End: {end_idx}")
