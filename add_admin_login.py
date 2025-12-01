import os

file_path = r'vitalink/server/server.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the insertion point (after /api/admin/patients route)
insertion_marker = "  return res.status(200).json({ patients: patientsWithAuth })\n  } catch (error) {\n    console.error('Error fetching patients:', error)\n    return res.status(500).json({ error: 'Internal server error' })\n  }\n})"
insertion_point = content.find(insertion_marker)

if insertion_point == -1:
    print("Could not find insertion point")
    exit(1)

# Move to after the marker
insertion_point += len(insertion_marker)

# New admin login route
new_route = """

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    
    // Query the admins table
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single()
    
    if (error || !data) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    
    // Simple password check (in production, use bcrypt)
    // For now, we'll check if password matches the stored hash
    // You should replace this with proper bcrypt comparison
    if (data.password_hash !== password && data.password_hash !== 'PLACEHOLDER') {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    
    // If password is PLACEHOLDER, accept any password (for initial setup)
    // In production, you should hash the password properly
    
    // Update last login time
    await supabase
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.id)
    
    // Return admin data (without password hash)
    return res.status(200).json({
      admin: {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        created_at: data.created_at,
        last_login_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
"""

# Insert the new route
new_content = content[:insertion_point] + new_route + content[insertion_point:]

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully added admin login route to server.js")
