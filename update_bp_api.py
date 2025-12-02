import re

file_path = r'vitalink/web/src/lib/api.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add bpServerUrl function after serverUrl function
serverurl_pattern = r"(export function serverUrl\(\) \{[^}]+\})"
replacement = r"""\1

// Separate URL for BP image processing backend only
export function bpServerUrl() {
  const fromEnv = import.meta.env.VITE_BP_SERVER_URL as string | undefined
  return (fromEnv && fromEnv.length > 0) ? fromEnv : serverUrl()
}"""

content = re.sub(serverurl_pattern, replacement, content, count=1)

# 2. Update processImage to use bpServerUrl
content = content.replace(
    "const res = await fetch(`${serverUrl()}/api/process-image`",
    "const res = await fetch(`${bpServerUrl()}/api/process-image`"
)

# 3. Update addManualEvent to use bpServerUrl  
content = content.replace(
    "const res = await fetch(`${serverUrl()}/api/add-manual-event`",
    "const res = await fetch(`${bpServerUrl()}/api/add-manual-event`"
)

# 4. Update getHealthEvents to use bpServerUrl
content = content.replace(
    "const url = userId ? `${serverUrl()}/api/health-events?user_id=${encodeURIComponent(userId)}` : `${serverUrl()}/api/health-events`",
    "const url = userId ? `${bpServerUrl()}/api/health-events?user_id=${encodeURIComponent(userId)}` : `${bpServerUrl()}/api/health-events`"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Successfully updated api.ts:")
print("  - Added bpServerUrl() function")
print("  - Updated processImage() to use BP server")
print("  - Updated addManualEvent() to use BP server")
print("  - Updated getHealthEvents() to use BP server")
